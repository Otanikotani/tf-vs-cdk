resource "aws_s3_bucket" "co_tf_resource_ingestion_bucket" {
  bucket = "co-tf-resource-ingestion-bucket-${var.stage}"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "co_tf_resource_ingestion_bucket_acl" {
  bucket = aws_s3_bucket.co_tf_resource_ingestion_bucket.id

  block_public_acls = true
  block_public_policy = true
}

resource "aws_glue_catalog_database" "co_tf_glue_database" {
  name = "co-tf-glue-database"
}

data "aws_iam_policy_document" "glue_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type = "Service"
      identifiers = ["glue.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "co_tf_crawler_role" {
  name = "co_tf_crawler_role_${var.stage}"
  assume_role_policy = data.aws_iam_policy_document.glue_assume_role.json
}

resource "aws_iam_role_policy_attachment" "co_tf_crawler_service_role_attachment" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSGlueServiceRole"
  role = aws_iam_role.co_tf_crawler_role.name
}

data "aws_iam_policy_document" "co_tf_crawler_access_s3" {
  statement {
    actions = [
      "s3:GetObject",
      "s3:PutObject"]
    effect = "Allow"
    resources = [
      "${aws_s3_bucket.co_tf_resource_ingestion_bucket.arn}*"]
  }
}

resource "aws_iam_policy" "co_tf_crawler_policy" {
  name = "co-tf-crawler-policy-${var.stage}"
  policy = data.aws_iam_policy_document.co_tf_crawler_access_s3.json
}

resource "aws_iam_role_policy_attachment" "co_tf_crawler_service_role_attachment_inline" {
  policy_arn = aws_iam_policy.co_tf_crawler_policy.arn
  role = aws_iam_role.co_tf_crawler_role.name
}

resource "aws_glue_crawler" "co_tf_crawler" {
  database_name = aws_glue_catalog_database.co_tf_glue_database.name
  name = "co-tf-crawler-${var.stage}"
  role = aws_iam_role.co_tf_crawler_role.name
  s3_target {
    path = "s3://${aws_s3_bucket.co_tf_resource_ingestion_bucket.bucket}"
  }
}

resource "aws_s3_bucket" "co_tf_job_bucket" {
  bucket = "co-tf-job-bucket-${var.stage}"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "co_tf_job_bucket_acl" {
  bucket = aws_s3_bucket.co_tf_job_bucket.id

  block_public_acls = true
  block_public_policy = true
}

resource "aws_s3_bucket_object" "bulk_load_job_source" {
  for_each = fileset("orchestration/jobs/", "**/*")
  bucket = aws_s3_bucket.co_tf_job_bucket.bucket
  key = each.value
  source = "orchestration/jobs/${each.value}"
}

resource "aws_iam_role" "co_tf_glue_job_role" {
  name = "co_tf_inspect_role_${var.stage}"
  assume_role_policy = data.aws_iam_policy_document.glue_assume_role.json
}

resource "aws_iam_role_policy_attachment" "co_tf_inspect_role_service_role_attachment" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSGlueServiceRole"
  role = aws_iam_role.co_tf_glue_job_role.name
}

data "aws_iam_policy_document" "co_tf_inspect_role_access_s3" {
  statement {
    actions = [
      "s3:*"]
    effect = "Allow"
    resources = [
      "${aws_s3_bucket.co_tf_job_bucket.arn}*",
      "${aws_s3_bucket.co_tf_resource_ingestion_bucket.arn}*",
    ]
  }
}

resource "aws_iam_policy" "co_tf_inspect_role_access_s3_policy" {
  name = "co-tf-inspect-role-access-s3-policy-${var.stage}"
  policy = data.aws_iam_policy_document.co_tf_inspect_role_access_s3.json
}

resource "aws_iam_role_policy_attachment" "co_tf_inspect_role_access_s3_policy_attachment" {
  policy_arn = aws_iam_policy.co_tf_inspect_role_access_s3_policy.arn
  role = aws_iam_role.co_tf_glue_job_role.name
}

data "aws_iam_policy_document" "co_tf_inspect_role_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    effect = "Allow"
    resources = ["arn:aws:iam::*:role/co-third-party-inspection-role'"]
  }
}

resource "aws_iam_policy" "co_tf_inspect_role_assume_policy" {
  name = "co-tf-inspect-role-assume-policy-${var.stage}"
  policy = data.aws_iam_policy_document.co_tf_inspect_role_assume.json
}

resource "aws_iam_role_policy_attachment" "co_tf_inspect_role_assume_policy_attachment" {
  policy_arn = aws_iam_policy.co_tf_inspect_role_assume_policy.arn
  role = aws_iam_role.co_tf_glue_job_role.name
}


data "aws_iam_policy_document" "co_tf_neptune_access_role_assumptions" {
  statement {
    actions = [
      "sts:AssumeRole"]

    principals {
      type = "Service"
      identifiers = [
        "glue.amazonaws.com"]
    }

    principals {
      type = "Service"
      identifiers = [
        "lambda.amazonaws.com"]
    }

    principals {
      type = "AWS"
      identifiers = [
        aws_iam_role.co_tf_glue_job_role.arn]
    }

    principals {
      type = "AWS"
      identifiers = [
        var.neptune_role_arn]
    }
  }
}

resource "aws_iam_role" "co_tf_neptune_access_role" {
  name = "co-tf-neptune-access-role-${var.stage}"
  assume_role_policy = data.aws_iam_policy_document.co_tf_neptune_access_role_assumptions.json
}

data "aws_iam_policy_document" "co_tf_neptune_access_role_policy_document" {
  statement {
    actions = [
      "neptune-db:connect"]
    effect = "Allow"
    resources = [
      "arn:aws:neptune-db:*"]
  }
}

resource "aws_iam_policy" "co_tf_neptune_access_role_policy" {
  name = "co-tf-neptune-role-access-neptune-policy-${var.stage}"
  policy = data.aws_iam_policy_document.co_tf_neptune_access_role_policy_document.json
}

resource "aws_iam_role_policy_attachment" "co_tf_neptune_access_role_policy_attachment" {
  policy_arn = aws_iam_policy.co_tf_neptune_access_role_policy.arn
  role = aws_iam_role.co_tf_neptune_access_role.name
}

resource "aws_glue_connection" "co_tf_glue_neptune_connection" {
  name = "co-tf-glue-neptune-connection-${var.stage}"
  physical_connection_requirements {
    subnet_id = ""
  }
  connection_type = "JDBC"
  connection_properties = {
    JDBC_CONNECTION_URL = "jdbc:wss://${var.neptune_endpoint}:8182/gremlin"
    JDBC_ENFORCE_SSL = "false"
    PASSWORD = "dummy"
    USERNAME = "dummy"
  }
}

resource "aws_glue_job" "co_tf_ec2_job" {
  name = "co-tf-get-ec2-data-job-${var.stage}"
  role_arn = aws_iam_role.co_tf_glue_job_role.arn
  command {
    name = "pythonshell" //No more suggestions for literal value than in CDK, both suck
    python_version = "3" //No more suggestions for literal value than in CDK, both suck
    script_location = "s3://${aws_s3_bucket.co_tf_job_bucket.bucket}/get-ec2-job.py"
  }
  default_arguments = {
    "--resource_ingestion_bucket_name": aws_s3_bucket.co_tf_resource_ingestion_bucket.bucket
  }
  glue_version = "1.0"
}

resource "aws_glue_job" "co_tf_transform_job" {
  name = "co-tf-transform-job-${var.stage}"
  role_arn = aws_iam_role.co_tf_glue_job_role.arn
  command {
    name = "glueetl"
    python_version = "3" //No more suggestions for literal value than in CDK, both suck
    script_location = "s3://${aws_s3_bucket.co_tf_job_bucket.bucket}/transform.py"
  }
  default_arguments = {
    "--extra-py-files": "s3://${aws_s3_bucket.co_tf_job_bucket.bucket}/lib/neptune_python_utils.zip"
    "--resource_ingestion_bucket_name": aws_s3_bucket.co_tf_resource_ingestion_bucket.bucket
    "--resource_database": aws_glue_catalog_database.co_tf_glue_database.name
  }
  glue_version = "2.0"
}

resource "aws_glue_job" "co_tf_bulk_load_job" {
  name = "co-tf-bulk-load-job-${var.stage}"
  role_arn = aws_iam_role.co_tf_glue_job_role.arn
  command {
    name = "pythonshell" //No more suggestions for literal value than in CDK, both suck
    python_version = "3" //No more suggestions for literal value than in CDK, both suck
    script_location = "s3://${aws_s3_bucket.co_tf_job_bucket.bucket}/bulk-load.py"
  }
  connections = [
    aws_glue_connection.co_tf_glue_neptune_connection.name //Slightly better than in CDK
  ]
  default_arguments = {
    "--extra-py-files": "s3://${aws_s3_bucket.co_tf_job_bucket.bucket}/lib/neptune_python_utils-0.0.0-py3.6.egg"
    "--neptune_connection_role": aws_iam_role.co_tf_neptune_access_role.arn,
    "--neptune_connection_name": "co-neptune-connection-${var.stage}",
    "--neptune_to_s3_role": var.neptune_role_arn
  }
  glue_version = "1.0"
}

resource "aws_glue_workflow" "co-tf-bulk-load-workflow" {
  name = "co-tf-bulk_load_worklfow_${var.stage}"
}

resource "aws_glue_trigger" "co-tf-start-inspection-trigger" {
  name = "co-tf-start-inspection-trigger-${var.stage}"
  type = "ON_DEMAND"
  workflow_name = aws_glue_workflow.co-tf-bulk-load-workflow.name
  actions {
    job_name = aws_glue_job.co_tf_ec2_job.name
  }
}

resource "aws_glue_trigger" "co-tf-wait-until-loaded-trigger" {
  name = "co-tf-wait-until-loaded-trigger-${var.stage}"
  type = "CONDITIONAL"
  workflow_name = aws_glue_workflow.co-tf-bulk-load-workflow.name
  actions {
    crawler_name = aws_glue_crawler.co_tf_crawler.name
  }
  predicate {
    conditions {
      logical_operator = "EQUALS"
      state = "SUCCEEDED"
      job_name = aws_glue_job.co_tf_ec2_job.name
    }
  }
}

resource "aws_glue_trigger" "co-tf-wait-until-crawled-trigger" {
  name = "co-tf-wait-until-crawled-trigger-${var.stage}"
  type = "CONDITIONAL"
  workflow_name = aws_glue_workflow.co-tf-bulk-load-workflow.name
  actions {
    job_name = aws_glue_job.co_tf_transform_job.name
  }
  predicate {
    conditions {
      logical_operator = "EQUALS"
      crawl_state = "SUCCEEDED"
      crawler_name = aws_glue_crawler.co_tf_crawler.name
    }
  }
}

resource "aws_glue_trigger" "co-tf-wait-until-transformed-trigger" {
  name = "co-tf-wait-until-transformed-trigger-${var.stage}"
  type = "CONDITIONAL"
  workflow_name = aws_glue_workflow.co-tf-bulk-load-workflow.name
  actions {
    job_name = aws_glue_job.co_tf_bulk_load_job.name
  }
  predicate {
    conditions {
      logical_operator = "EQUALS"
      state = "SUCCEEDED"
      job_name = aws_glue_job.co_tf_transform_job.name
    }
  }
}

