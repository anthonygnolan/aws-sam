import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import axios from 'axios';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Metrics, MetricUnits } from '@aws-lambda-powertools/metrics';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
const metrics = new Metrics();
const logger = new Logger();
const tracer = new Tracer();

const client = tracer.captureAWSv3Client(new SecretsManagerClient({}));

//const client = new SecretsManagerClient({});

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {APIGatewayProxyEvent} event - API Gateway Lambda Proxy Input Format
 * @param {Context} object - API Gateway Lambda $context variable
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {APIGatewayProxyResult} object - API Gateway Lambda Proxy Output Format
 *
 */

export const lambdaHandler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    await axios.get('https://httpbin.org/status/200');
    let response: APIGatewayProxyResult;

    // Log the incoming event
    logger.info('Lambda invocation event', { event });

    // Append awsRequestId to each log statement
    logger.appendKeys({
        awsRequestId: context.awsRequestId,
    });
    // Get facade segment created by AWS Lambda
    const segment = tracer.getSegment();

    if (!segment) {
        response = {
            statusCode: 500,
            body: 'Failed to get segment',
        };
        return response;
    }

    const input = { SecretId: 'PowertoolsSecret' };
    const command = new GetSecretValueCommand(input);
    const secret = await client.send(command);
    // Create subsegment for the function & set it as active
    const handlerSegment = segment.addNewSubsegment(`## ${process.env._HANDLER}`);
    tracer.setSegment(handlerSegment);

    // Annotate the subsegment with the cold start & serviceName
    tracer.annotateColdStart();
    tracer.addServiceNameAnnotation();

    // Add annotation for the awsRequestId
    tracer.putAnnotation('awsRequestId', context.awsRequestId);
    // Capture cold start metrics
    metrics.captureColdStartMetric();
    // Create another subsegment & set it as active
    const subsegment = handlerSegment.addNewSubsegment('### MySubSegment');
    tracer.setSegment(subsegment);

    try {
        // hello world code
        response = {
            statusCode: 200,
            body: JSON.stringify({
                message: secret.SecretString,
            }),
        };
        logger.info(`Successful response from API enpoint: ${event.path}`, response.body);
    } catch (err) {
        // Error handling
        response = {
            statusCode: 500,
            body: JSON.stringify({
                message: 'some error happened',
            }),
        };
        tracer.addErrorAsMetadata(err as Error);
        logger.error(`Error response from API enpoint: ${err}`, response.body);
    } finally {
        // Close subsegments (the AWS Lambda one is closed automatically)
        subsegment.close(); // (### MySubSegment)
        handlerSegment.close(); // (## index.handler)

        // Set the facade segment as active again (the one created by AWS Lambda)
        tracer.setSegment(segment);
        // Publish all stored metrics
        metrics.publishStoredMetrics();
    }

    return response;
};
