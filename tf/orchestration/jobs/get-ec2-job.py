import sys
import boto3
import json
from botocore.config import Config
from awsglue.utils import getResolvedOptions

args = getResolvedOptions(sys.argv, ['resource_ingestion_bucket_name'])

s3 = boto3.client('s3')

account = '11111111111' # hardcoded for simplicity, some account with an ec2 instance and installed assumed role
role = 'szdfxgchjkgf' # The role installed in customer's inventory
region = 'us-east-1' # hardcoded for simplicity

sts_connection = boto3.client('sts')
acct_b = sts_connection.assume_role(
        RoleArn="arn:aws:iam::" + account + ":role/" + role,
        RoleSessionName="cross_acct_lambda"
)

ACCESS_KEY = acct_b['Credentials']['AccessKeyId']
SECRET_KEY = acct_b['Credentials']['SecretAccessKey']
SESSION_TOKEN = acct_b['Credentials']['SessionToken']

region_config = Config(region_name = region)

client = boto3.client(
        'ec2',
        aws_access_key_id=ACCESS_KEY,
        aws_secret_access_key=SECRET_KEY,
        aws_session_token=SESSION_TOKEN,
        config=region_config
)

response = client.describe_instances()

print(response)

s3.put_object(
        Body=str(json.dumps(response, default=str)),
        Bucket=args['resource_ingestion_bucket_name'],
        Key='account=' + account + '/region=' + region + '/ec2.json'
)
