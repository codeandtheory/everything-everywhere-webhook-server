module "ec2_instance_webhook_server" {
  source = "github.com/terraform-aws-modules/terraform-aws-ec2-instance?ref=5b17f94c354eb3fa2b3bc435c861b916c9668e05"

  name                        = "${var.project_code}-webhook-server"
  ami                         = var.webhook_server_config.ami
  instance_type               = var.webhook_server_config.instance_type
  subnet_id                   = module.vpc.public_subnets[0]
  associate_public_ip_address = true

  vpc_security_group_ids = [
    module.sg_webhook_server.security_group_id
  ]

  root_block_device = [
    {
      volume_size = 20
      volume_type = "gp2"
    }
  ]
}

module "sg_webhook_server" {
  source = "github.com/terraform-aws-modules/terraform-aws-security-group?ref=badbab67cd0d7f976523fd44647e1ee9fb87001b"

  name        = "${var.project_code}-webhook-server"
  description = "For the ${var.project_name} webhook server"
  vpc_id      = module.vpc.vpc_id

  ingress_with_cidr_blocks = concat(
    [
      for entry in var.cidr_allowlist :
      merge(
        {
          rule = "ssh-tcp"
        },
        entry
      )
    ],
    [
      {
        from_port   = var.webhook_server_config.port
        to_port     = var.webhook_server_config.port
        protocol    = "tcp"
        cidr_blocks = "0.0.0.0/0"
        description = "For the Node.js webhook server"
      }
    ]
  )

  ingress_with_prefix_list_ids = [
    {
      rule            = "ssh-tcp"
      description     = "For EC2 Instance Connect from AWS console"
      prefix_list_ids = "pl-0e4bcff02b13bef1e", # com.amazonaws.us-east-1.ec2-instance-connect
    },
  ]

  egress_with_cidr_blocks = [
    {
      rule        = "https-443-tcp"
      cidr_blocks = "0.0.0.0/0"
      description = "Allow HTTPS outbound"
    },
  ]

  tags = {
    Name = "${var.project_code}-webhook-server"
  }
}
