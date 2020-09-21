import sys

from awsglue.context import GlueContext
from awsglue.job import Job
from awsglue.transforms import ApplyMapping
from awsglue.transforms import Relationalize
from awsglue.transforms import SelectFields
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from awsglue.dynamicframe import DynamicFrame

from neptune_python_utils.bulkload import BulkLoad
from neptune_python_utils.glue_gremlin_csv_transforms import GlueGremlinCsvTransforms


args = getResolvedOptions(sys.argv, ['JOB_NAME', 'resource_ingestion_bucket_name', 'resource_database'])

sc = SparkContext()
glueContext = GlueContext(sc)

job = Job(glueContext)
job.init(args['JOB_NAME'], args)

database = args['resource_database']
s3bucket = args['resource_ingestion_bucket_name']
nodes_folder = 's3://' + s3bucket + '/output-dir/nodes'
tempDir = 's3://' + s3bucket + '/temp-dir/'
ec2_table = s3bucket.replace("-", "_")

def writeCsvFile(datasource, path):
    dataframe = DynamicFrame.toDF(datasource).repartition(1)
    datasource = DynamicFrame.fromDF(dataframe, glueContext, 'write-csv')
    glueContext.write_dynamic_frame.from_options(frame = datasource, connection_type = "s3", connection_options = {"path": path}, format = "csv", transformation_ctx = "write-csv")


print("Creating EC2 vertices...")

ec2s = glueContext.create_dynamic_frame.from_catalog(database=database, table_name=ec2_table,
                                                     transformation_ctx="datasource0")


# 1 Relationalized json to a collection of flat tables
relationalized_dynamic_frames = Relationalize.apply(frame=ec2s, staging_path=tempDir, transformation_ctx="relationalized_dynamic_frames")

# 'roottable' is the default prefix of relationalization
rdf = relationalized_dynamic_frames.select('roottable_Reservations.val.Instances')

rdf.show(1)

# 2. Map fields to bulk load CSV column headings format
applymapping1 = ApplyMapping.apply(frame=rdf, mappings=[
    ("`Reservations.val.Instances.val.InstanceId`", "string", "instanceId:String", "string"),
    ("`Reservations.val.Instances.val.InstanceType`", "string", "instanceType:String", "string")
], transformation_ctx="applymapping1")

applymapping1.show(1)

# 3. Append prefixes to values in ID columns (ensures vertices for different types have unique IDs across graph)
applymapping2 = GlueGremlinCsvTransforms.create_prefixed_columns(applymapping1, [('~id', 'instanceId:String', 'ec2')])

# 4. Select fields for upsert
selectfields1 = SelectFields.apply(frame=applymapping2, paths=["~id", 'instanceId:String', 'instanceType:String'],
                                   transformation_ctx="selectfields1")

# 5. Write to s3
writeCsvFile(GlueGremlinCsvTransforms.addLabel(selectfields1, 'EC2'), nodes_folder)

job.commit()

print("Done")
