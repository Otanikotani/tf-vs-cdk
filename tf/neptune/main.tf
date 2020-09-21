resource "aws_neptune_subnet_group" "co_tf_neptune_subnet_group" {
  subnet_ids = var.subnets
  name = "co_tf_neptune_subnet_group_${var.stage}"
}

resource "aws_neptune_cluster_parameter_group" "co_tf_neptune_cluster_parameter_group" {
  family = "neptune1"
  name = "co-tf-neptune-cluster-parameter-group-${var.stage}"

  parameter {
    name = "neptune_enforce_ssl"
    value = "0"
  }
}

data "aws_iam_policy_document" "rds_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type = "Service"
      identifiers = ["rds.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "co_tf_neptune_to_s3_access_role" {
  name = "co_tf_neptune_to_s3_access_role_${var.stage}"
  assume_role_policy = data.aws_iam_policy_document.rds_assume_role.json
}

resource "aws_iam_role_policy_attachment" "co_tf_neptune_role_full_s3_access" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess"
  role = aws_iam_role.co_tf_neptune_to_s3_access_role.name
}

resource "aws_neptune_cluster" "co_tf_neptune_cluster" {
  cluster_identifier = "co-tf-neptune-${var.stage}"
  neptune_subnet_group_name = aws_neptune_subnet_group.co_tf_neptune_subnet_group.name
  neptune_cluster_parameter_group_name = aws_neptune_cluster_parameter_group.co_tf_neptune_cluster_parameter_group.name
  iam_database_authentication_enabled = false
  vpc_security_group_ids = [var.security_group_id]
  iam_roles = [aws_iam_role.co_tf_neptune_to_s3_access_role.arn]
  skip_final_snapshot = true
}

resource "aws_neptune_cluster_instance" "co_tf_neptune_cluster_instance" {
  instance_class = "db.t3.medium"
  cluster_identifier = aws_neptune_cluster.co_tf_neptune_cluster.cluster_identifier
}

output "neptune_cluster_endpoint" {
  value = aws_neptune_cluster.co_tf_neptune_cluster.endpoint
}

output "neptune_role_arn" {
  value = aws_iam_role.co_tf_neptune_to_s3_access_role.arn
}

output "neptune_reader_endpoint" {
  value = aws_neptune_cluster.co_tf_neptune_cluster.reader_endpoint
}