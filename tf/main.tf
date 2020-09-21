terraform {
  backend "s3" {
    bucket = "otanikotani-tf"
    key = "co-tf.tfstate"
    region = "us-east-1"
    encrypt = true
  }
}

provider "aws" {
  region  = "us-east-1"
  profile = "co-admin"
}

variable "stage" {
  default = "dev"
}

module "network" {
  source = "./network"
  stage = var.stage
}

module "neptune" {
  source = "./neptune"
  subnets = module.network.subnets
  security_group_id = module.network.security_group_id
  stage = var.stage
}

module "orchestration" {
  source = "./orchestration"
  neptune_endpoint = module.neptune.neptune_cluster_endpoint
  neptune_role_arn = module.neptune.neptune_role_arn
  stage = var.stage
}