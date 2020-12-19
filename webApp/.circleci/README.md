To deploy scripts with CI/CD
Create a circleCI user token and run the following script
curl -u [your-token-number]\
    -d build_parameters[CIRCLE_JOB]=build \
    https://circleci.com/api/v1.1/project/github/[your-github-userame]/webApp/tree/[assignment branch]
