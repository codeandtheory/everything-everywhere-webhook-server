terraform {
  required_version = ">= 1.11.3"

  backend "s3" {
    bucket         = "eeaao-terraform-remote-state"
    encrypt        = true
    key            = "main.tfstate"
    region         = "us-east-1"
    dynamodb_table = "eeaao-terraform-state-lock"
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.95.0"
    }
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = var.default_tags
  }
}
