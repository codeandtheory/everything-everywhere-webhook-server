locals {
  region       = "us-east-1"
  project_code = "eeaao"
}

terraform {
  required_version = ">= 1.11.3"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.95.0"
    }
  }
}

provider "aws" {
  region = local.region

  default_tags {
    tags = {
      "Client"    = "CODE"
      "Project"   = "EEAAO"
      "Tech Lead" = "Joe Mango"
      "Terraform" = true
    }
  }
}
