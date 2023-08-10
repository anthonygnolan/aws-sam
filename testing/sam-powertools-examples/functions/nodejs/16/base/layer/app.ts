import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import AWS from 'aws-sdk';

let secret: { SecretString: any; };
const params = {
    SecretId: 'SecretsManagerSecret',
};
const secretsmanager = new AWS.SecretsManager();
secretsmanager.getSecretValue(params, function (err: { stack: any; }, data: { SecretString: any; }) {
    if (err) console.log(err, err.stack); // an error occurred
    else console.log(data); // successful response
    secret = data;
});

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */

export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    let response: APIGatewayProxyResult;

    try {
        response = {
            statusCode: 200,
            body: JSON.stringify({
                message: secret.SecretString,
            }),
        };
    } catch (err: unknown) {
        console.error(err);
        response = {
            statusCode: 500,
            body: JSON.stringify({
                message: err instanceof Error ? err.message : 'some error happened',
            }),
        };
    }

    return response;
};
