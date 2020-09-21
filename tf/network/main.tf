data "aws_vpc" "central_vpc" {
  id = "vpc-0156cd9a85b4b3fac"
}

data "aws_subnet_ids" "central_vpc_subnets" {
  vpc_id = data.aws_vpc.central_vpc.id
}

data "aws_subnet" "central_vpc_subnet" {
  for_each = data.aws_subnet_ids.central_vpc_subnets.ids
  id = each.value
}

resource "aws_security_group" "co_tf_neptune_security_group" {
  name = "co-tf-neptune-security-group-${var.stage}"
  vpc_id = data.aws_vpc.central_vpc.id

  ingress {
    from_port = 0
    protocol = -1
    to_port = 0
    self = true //this required googling
  }
}

resource "aws_security_group_rule" "co_tf_neptune_security_group_gremlin" {
  from_port = 8182
  to_port = 8182
  protocol = "tcp"
  security_group_id = aws_security_group.co_tf_neptune_security_group.id
  type = "ingress"
  cidr_blocks = ["0.0.0.0/0"]
}

output "subnets" {
  value = [for s in data.aws_subnet.central_vpc_subnet : s.id]
}

output "security_group_id" {
  value = aws_security_group.co_tf_neptune_security_group.id
}