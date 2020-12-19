#!/bin/bash

if [ "$#" -ne 7 ]; then
    echo "Invalid number of parameters"
    echo Usage: bash create-network-setup.sh \<aws_region\> \<vpc_cidr\> \<subnet1\> \<subnet2\> \<subnet3\> \<vpc_name\> \<profile\>
    exit 1
fi

VPC_NAME=$6

VPC_CIDR=$2

if [[ $VPC_CIDR =~ ^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(3[0-2]|[0-2][0-9]|[0-9])$ ]] ; then
     echo VPC_CIDR: $VPC_CIDR
  else
          echo Enter Valid CIDR Block
          exit 1
  fi

#echo Enter the AWS Region
AWS_REGION=$1

if [[ "$7" = "dev" ]] ; then
        AWS_Profile="dev"
   elif [[ "$7" = "prod" ]] ; then
        AWS_Profile="prod"
      else
           echo Creation of VPC Failed... Define Profile as dev or prod.
           exit 1
fi

SUBNET1=$3

if [[ $SUBNET1 =~ ^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(3[0-2]|[0-2][0-9]|[0-9])$ ]] ; then
     echo Public Subnet 1: $SUBNET1
  else
          echo Enter Valid CIDR Block
          exit 1
fi

SUBNET2=$4

if [[ $SUBNET2 =~ ^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(3[0-2]|[0-2][0-9]|[0-9])$ ]] ; then
     echo Public Subnet 2: $SUBNET2
  else
          echo Enter Valid CIDR Block 
          exit 1
fi

SUBNET3=$5

if [[ $SUBNET3 =~ ^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(3[0-2]|[0-2][0-9]|[0-9])$ ]] ; then
     echo Public Subnet 3: $SUBNET3
  else
          echo Enter Valid CIDR Block 
          exit 1
fi

export AWS_PROFILE=$AWS_Profile
echo $AWS_PROFILE

ZONE1="${AWS_REGION}a"
ZONE2="${AWS_REGION}b"
ZONE3="${AWS_REGION}c"

echo "Zone 1 = $ZONE1"
echo "Zone 2 = $ZONE2"
echo "Zone 3 = $ZONE3"

#*****************************
#Creating a new VPC
#*****************************
echo "Creating '$VPC_NAME' in '$AWS_REGION' with $VPC_CIDR IP Address……."

VPC_ID=$(aws ec2 create-vpc \
  --cidr-block $VPC_CIDR \
  --query 'Vpc.{VpcId:VpcId}' \
  --region $AWS_REGION \
  --output text  2>&1)
if [ $? -ne "0" ]
then
  echo "Creation of VPC failed...."
  exit 1

else
  echo "  VPC ID '$VPC_ID' CREATED in '$AWS_REGION' region."
fi

# Add Name tag to VPC
aws ec2 create-tags \
  --resources $VPC_ID \
  --tags "Key=Name,Value=$VPC_NAME" \
  --region $AWS_REGION
echo "  VPC ID '$VPC_ID' NAMED as '$VPC_NAME'."

#*****************************
# Create Internet gateway
#*****************************
echo "Creating Internet Gateway..."
IGW_ID=$(aws ec2 create-internet-gateway \
  --query 'InternetGateway.{InternetGatewayId:InternetGatewayId}' \
  --region $AWS_REGION \
  --output text 2>&1 )
if [ $? -ne "0" ]
then
  echo "Creation of Internet Gateway failed...."
  exit 1
else
  echo "  Internet Gateway ID '$IGW_ID' CREATED."
fi

#*****************************
# Attach Internet gateway to your VPC
#*****************************
echo "Attaching internet gateway "$IGW_ID" to VPC "$VPC_ID" "
aws ec2 attach-internet-gateway \
  --vpc-id $VPC_ID \
  --internet-gateway-id $IGW_ID \
  --region $AWS_REGION

if [ $? -ne "0" ]
then
  echo "Attaching Internet gateway to VPC failed...."
  exit 1
else
  echo "  Internet Gateway ID '$IGW_ID' ATTACHED to VPC ID '$VPC_ID'."
fi

#*****************************
#echo Creation of subnet 1"
#*****************************

SUBNET_1=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block $SUBNET1 \
  --availability-zone $ZONE1 \
  --query 'Subnet.{SubnetId:SubnetId}' \
  --output text \
  --region $AWS_REGION 2>&1)

echo  "Subnet ID '$SUBNET_1' is created in '$ZONE1'" "Availability Zone."

# Add Name tag to Public Subnet
aws ec2 create-tags \
  --resources $SUBNET_1 \
  --tags "Key=Name,Value=Subnet1" \
  --region $AWS_REGION
echo "  Subnet ID '$SUBNET_1' NAMED as Subnet1'."

aws ec2 modify-subnet-attribute --subnet-id "$SUBNET_1" --region $AWS_REGION --map-public-ip-on-launch

#*****************************
#Creation of subnet 2
#*****************************

SUBNET_2=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID\
  --cidr-block $SUBNET2 \
  --availability-zone $ZONE2 \
  --query 'Subnet.{SubnetId:SubnetId}' \
  --output text \
  --region $AWS_REGION 2>&1)

echo  "Subnet ID '$SUBNET_2' is created in '$ZONE2'" "Availability Zone."

# Add Name tag to Public Subnet
aws ec2 create-tags \
  --resources $SUBNET_2 \
  --tags "Key=Name,Value=Subnet2" \
  --region $AWS_REGION
echo "  Subnet ID '$SUBNET_2' NAMED as Subnet2."


aws ec2 modify-subnet-attribute --subnet-id "$SUBNET_2" --region $AWS_REGION --map-public-ip-on-launch

#*****************************
# Creation of subnet 3
#*****************************

SUBNET_3=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block $SUBNET3 \
  --availability-zone $ZONE3 \
  --query 'Subnet.{SubnetId:SubnetId}' \
  --output text \
  --region $AWS_REGION 2>&1)

echo  "Subnet ID '$SUBNET_3' is created in '$ZONE3'" "Availability Zone."

# Add Name tag to Public Subnet
aws ec2 create-tags \
  --resources $SUBNET_3 \
  --tags "Key=Name,Value=Subnet3" \
  --region $AWS_REGION
echo "  Subnet ID '$SUBNET_3' NAMED as Subnet3."

aws ec2 modify-subnet-attribute --subnet-id "$SUBNET_3" --region $AWS_REGION --map-public-ip-on-launch


#*****************************
# Create Route Table
#*****************************
echo "Creating Route Table..."
ROUTE_TABLE_ID=$(aws ec2 create-route-table \
  --vpc-id $VPC_ID \
  --query 'RouteTable.{RouteTableId:RouteTableId}' \
  --region $AWS_REGION \
  --output text 2>&1)
if [ $? -ne "0" ]
then
  echo "Creating ROUTE_TABLE failed...."
  exit 1
else
  echo "  Route Table ID '$ROUTE_TABLE_ID' CREATED."
fi

#*****************************
# Create route to Internet Gateway
#*****************************

ALL_ROUTE="0.0.0.0/0"

Route=$(aws ec2 create-route \
  --route-table-id $ROUTE_TABLE_ID \
  --destination-cidr-block $ALL_ROUTE \
  --gateway-id $IGW_ID \
  --region $AWS_REGION 2>&1)
if [ $? -ne "0" ]
then
  echo "Providing Route to Internet gateway failed...."
  exit 1
else
  echo "  Route $ALL_ROUTE is added with Internet Gateway ID '$IGW_ID' to" \
  "Route Table ID '$ROUTE_TABLE_ID'."
fi

#*****************************
# Associate Public Subnet with Route Table
#*****************************
Associate1=$(aws ec2 associate-route-table  \
  --subnet-id $SUBNET_1 \
  --route-table-id $ROUTE_TABLE_ID \
  --region $AWS_REGION 2>&1)
echo "  Public Subnet ID '$SUBNET_1' ASSOCIATED with Route Table ID" \
  "'$ROUTE_TABLE_ID'."

Associate2=$(aws ec2 associate-route-table  \
  --subnet-id $SUBNET_2 \
  --route-table-id $ROUTE_TABLE_ID \
  --region $AWS_REGION 2>&1)
echo "  Public Subnet ID '$SUBNET_2' ASSOCIATED with Route Table ID" \
  "'$ROUTE_TABLE_ID'."

Associate3=$(aws ec2 associate-route-table  \
  --subnet-id $SUBNET_3 \
  --route-table-id $ROUTE_TABLE_ID \
  --region $AWS_REGION 2>&1)
echo "  Public Subnet ID '$SUBNET_3' ASSOCIATED with Route Table ID" \
  "'$ROUTE_TABLE_ID'."
