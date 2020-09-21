import sys

from awsglue.utils import getResolvedOptions
from neptune_python_utils.glue_neptune_connection_info import GlueNeptuneConnectionInfo
from neptune_python_utils.gremlin_utils import GremlinUtils
from neptune_python_utils.bulkload import BulkLoad

args = getResolvedOptions(sys.argv, ['neptune_connection_role', 'neptune_connection_name', 'neptune_to_s3_role'])

print("Connect to neptune...")

# Simple way of creating endpoints, requires creating a dummy connection in Glue
endpoints = GlueNeptuneConnectionInfo('us-east-1', args['neptune_connection_role']).neptune_endpoints(args['neptune_connection_name'])

# Complex way of creating endpoints - no connection required, but needs the neptune url
# sts = boto3.client('sts', region_name='us-east-1')
# role = sts.assume_role(RoleArn=role_arn, RoleSessionName='bananananame', DurationSeconds=3600)
# credentials = Credentials(
#     access_key=role['Credentials']['AccessKeyId'],
#     secret_key=role['Credentials']['SecretAccessKey'],
#     token=role['Credentials']['SessionToken'])

gremlin_utils = GremlinUtils(endpoints)
conn = gremlin_utils.remote_connection(show_endpoint=True)
g = gremlin_utils.traversal_source(connection=conn)

print("Endpoints created")

print(g.V().limit(10).valueMap().toList())

print("Sanity checked")

bulkload = BulkLoad(
        source='s3://co-resource-ingestion-bucket-dev/output-dir/',
        role=args['neptune_to_s3_role'],
        region='us-east-1',
        endpoints=endpoints)

bulkload.load()

print("Bulk load is done")

conn.close()
