project_code = "eeaao"
project_name = "EEAAO"
region       = "us-east-1"

cidr_allowlist = [
  { cidr_blocks = "38.74.197.217/32", description = "C&T NY Office 1" },
  { cidr_blocks = "160.72.110.217/32", description = "C&T NY Office 2" },
]

default_tags = {
  "Client"                         = "CODE"
  "Project"                        = "EEAAO"
  "Tech Lead"                      = "Joe Mango"
  "Terraform"                      = true
  "Terraform Remote State Backend" = "s3"
  "Terraform Remote State Bucket"  = "eeaao-terraform-remote-state"
}

project_team_member_emails = [
  "christophe.garon@codeandtheory.com",
  "joe.mango@codeandtheory.com",
  "josh.wolf@codeandtheory.com",
  "kenton.jacobsen@codeandtheory.com",
  "michael.barrett@codeandtheory.com",
  "mike.cuilwik@codeandtheory.com",
]

webhook_server_config = {
  ami           = "ami-0e449927258d45bc4" # Amazon Linux 2023 AMI 2023.7.20250414.0 x86_64 HVM kernel-6.1
  instance_type = "t3.medium"
  port          = 3001
}
