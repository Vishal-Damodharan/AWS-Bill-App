#!/bin/bash

if [ "$#" -ne 3 ]; then
    echo "Invalid number of parameters"
    echo Usage: bash terminate-stack.sh \<AWS_REGION\> \<Stack_Name\> \<Stack_Profile\>
fi

AWS_REGION=$1
StackName=$2
AWS_Profile=$3


if [[ "$AWS_Profile" = "dev" ]] ; then
        AWS_Region="us-east-1"
   elif [[ "$AWS_Profile" = "prod" ]] ; then
        AWS_Region="us-east-2"
      else
           #echo Parameterizing VPC_ID Failed... Specify profile as dev or prod
           exit 1
fi


export AWS_PROFILE=$AWS_Profile

verify=$(aws cloudformation describe-stacks --stack-name $StackName --region $AWS_REGION 2>&1)

#****************************************************************************************************
#
#Terminate Stack
#
#****************************************************************************************************
if [ $? -eq 0 ]; then

    aws cloudformation delete-stack --stack-name $StackName --region $AWS_REGION
    echo Stack $StackName Found, Deleting Stack Now...
    aws cloudformation wait stack-delete-complete --stack-name $StackName --region $AWS_REGION

    echo Stack $StackName Deletion Successful!!!

  else
    echo Stack $StackName does not exist, enter a valid stack name...
    exit 1
fi