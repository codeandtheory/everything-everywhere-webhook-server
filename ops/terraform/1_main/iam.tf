resource "aws_iam_account_password_policy" "strict" {
  minimum_password_length        = 16
  password_reuse_prevention      = 3
  require_lowercase_characters   = true
  require_numbers                = true
  require_uppercase_characters   = true
  require_symbols                = true
  allow_users_to_change_password = true
}

resource "aws_iam_user" "team_members" {
  for_each = var.project_team_member_emails

  name = each.value
}

resource "aws_iam_group" "team" {
  name = "${var.project_code}-team"
}

resource "aws_iam_user_group_membership" "team" {
  for_each = aws_iam_user.team_members

  user   = each.value.name
  groups = [aws_iam_group.team.name]
}

resource "aws_iam_policy" "team" {
  name        = "${var.project_code}-team"
  description = "Grants full permissions for the ${var.project_name} project team members"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Sid    = "Services"
        Effect = "Allow"
        Action = [
          "cloudwatch:*",
          "compute-optimizer:*",
          "ec2:*",
          "ec2-instance-connect:*",
        ]
        Resource = ["*"]
      },
      {
        Sid    = "AllowViewAccountInfo"
        Effect = "Allow"
        Action = [
          "iam:GetAccountPasswordPolicy",
          "iam:GetAccountSummary"
        ]
        Resource = "*"
      },
      {
        Sid    = "AllowManageOwnPasswords"
        Effect = "Allow"
        Action = [
          "iam:ChangePassword",
          "iam:GetUser"
        ]
        Resource = "arn:aws:iam::*:user/$${aws:username}"
      },
      {
        Sid    = "AllowManageOwnAccessKeys"
        Effect = "Allow"
        Action = [
          "iam:CreateAccessKey",
          "iam:DeleteAccessKey",
          "iam:ListAccessKeys",
          "iam:UpdateAccessKey",
          "iam:GetAccessKeyLastUsed"
        ]
        Resource = "arn:aws:iam::*:user/$${aws:username}"
      }
    ]
  })
}

resource "aws_iam_group_policy_attachment" "team" {
  group      = aws_iam_group.team.name
  policy_arn = aws_iam_policy.team.arn
}
