#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STACK_NAME="${STACK_NAME:-tayari-canary}"
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
VPC_ID="${VPC_ID:-}"
SUBNET_ID="${SUBNET_ID:-}"
AMI_ID="${AMI_ID:-}"
ADMIN_CIDR="${ADMIN_CIDR:-}"
PUBLIC_DOMAIN="${PUBLIC_DOMAIN:-}"
INSTANCE_TYPE="${INSTANCE_TYPE:-t3.micro}"

for key in VPC_ID SUBNET_ID AMI_ID ADMIN_CIDR PUBLIC_DOMAIN; do
  if [[ -z "${!key}" ]]; then
    echo "$key is required. Example: VPC_ID=vpc-... SUBNET_ID=subnet-... AMI_ID=ami-... ADMIN_CIDR=203.0.113.10/32 PUBLIC_DOMAIN=jobs.example.com $0" >&2
    exit 1
  fi
done

command -v aws >/dev/null || { echo 'AWS CLI is required and must be authenticated.' >&2; exit 1; }

aws cloudformation deploy \
  --region "$REGION" \
  --stack-name "$STACK_NAME" \
  --template-file "$ROOT_DIR/deploy/aws/ec2-canary.yaml" \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    VpcId="$VPC_ID" \
    SubnetId="$SUBNET_ID" \
    AmiId="$AMI_ID" \
    InstanceType="$INSTANCE_TYPE" \
    AdminCidr="$ADMIN_CIDR" \
    PublicDomain="$PUBLIC_DOMAIN" \
  --tags Service=tayari Environment=canary ManagedBy=cloudformation

aws cloudformation describe-stacks \
  --region "$REGION" \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs' \
  --output table
