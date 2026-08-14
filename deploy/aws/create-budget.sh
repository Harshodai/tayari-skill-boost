#!/usr/bin/env bash
set -Eeuo pipefail

BUDGET_NAME="${BUDGET_NAME:-tayari-monthly-guardrail}"
LIMIT_USD="${LIMIT_USD:-10}"
ALERT_EMAIL="${ALERT_EMAIL:?ALERT_EMAIL is required}"
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
ACCOUNT_ID="${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}"

aws budgets create-budget \
  --account-id "$ACCOUNT_ID" \
  --region "$REGION" \
  --budget '{
    "BudgetName": "'"$BUDGET_NAME"'",
    "BudgetLimit": {"Amount": "'"$LIMIT_USD"'", "Unit": "USD"},
    "CostFilters": {"TagKeyValue": ["user:Service$tayari"]},
    "CostTypes": {"IncludeTax": true, "IncludeSubscription": true, "UseBlended": false, "IncludeRefund": false, "IncludeCredit": false, "IncludeUpfront": true, "IncludeRecurring": true, "IncludeOtherSubscription": true, "IncludeSupport": true, "IncludeDiscount": true, "UseAmortized": false},
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST"
  }' \
  --notifications-with-subscribers '[
    {"Notification":{"NotificationType":"ACTUAL","ComparisonOperator":"GREATER_THAN","Threshold":50,"ThresholdType":"PERCENTAGE"},"Subscribers":[{"SubscriptionType":"EMAIL","Address":"'"$ALERT_EMAIL"'"}]},
    {"Notification":{"NotificationType":"ACTUAL","ComparisonOperator":"GREATER_THAN","Threshold":80,"ThresholdType":"PERCENTAGE"},"Subscribers":[{"SubscriptionType":"EMAIL","Address":"'"$ALERT_EMAIL"'"}]},
    {"Notification":{"NotificationType":"FORECASTED","ComparisonOperator":"GREATER_THAN","Threshold":100,"ThresholdType":"PERCENTAGE"},"Subscribers":[{"SubscriptionType":"EMAIL","Address":"'"$ALERT_EMAIL"'"}]}
  ]' || {
    echo "Budget creation failed. It may already exist; inspect: aws budgets describe-budget --account-id $ACCOUNT_ID --budget-name $BUDGET_NAME" >&2
    exit 1
  }

echo "Created budget $BUDGET_NAME with a USD $LIMIT_USD monthly limit. Confirm the email subscription."
