variable "cidr_allowlist" {
  description = "List of CIDR block/description objects, used for restricting access to services"
  type        = list(object({ cidr_blocks = string, description = string }))
}

variable "default_tags" {
  description = "A map of strings to be applied to supported resources as tags"
  type        = map(string)
}

variable "project_code" {
  description = "The abbreviated name for the project, to be used in resource names"
  type        = string
}

variable "project_name" {
  description = "The name of the project, to be used in resource tags, description fields, etc."
  type        = string
}

variable "project_team_member_emails" {
  description = "The email addresses of the project team members"
  type        = set(string)
}

variable "region" {
  description = "The default AWS region"
  type        = string
}

variable "webhook_server_config" {
  description = "The configuration for the webhook server EC2 instance"
  type = object({
    ami           = string
    instance_type = string
    port          = number
  })
}
