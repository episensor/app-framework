/**
 * OpenAPI Documentation Middleware
 * Provides automatic API documentation generation
 */

import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Express } from "express";

export interface OpenAPIConfig {
  title: string;
  version: string;
  description?: string;
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  contact?: {
    name?: string;
    email?: string;
    url?: string;
  };
  license?: {
    name: string;
    url?: string;
  };
  tags?: Array<{
    name: string;
    description?: string;
  }>;
}

/**
 * Generate OpenAPI specification
 * @param config OpenAPI configuration
 * @param apis Array of file patterns for API routes
 */
export function generateOpenAPISpec(
  config: OpenAPIConfig,
  apis: string[],
): object {
  const options: swaggerJsdoc.Options = {
    definition: {
      openapi: "3.0.0",
      info: {
        title: config.title,
        version: config.version,
        description: config.description,
        contact: config.contact,
        license: config.license,
      },
      servers: config.servers || [
        {
          url: "http://localhost:3000",
          description: "Development server",
        },
      ],
      tags: config.tags,
      components: {
        schemas: {
          ApiResponse: {
            type: "object",
            properties: {
              success: {
                type: "boolean",
                description: "Indicates if the request was successful",
              },
              data: {
                type: "object",
                description: "Response data payload",
              },
              error: {
                type: "object",
                properties: {
                  code: {
                    type: "string",
                    description: "Error code",
                  },
                  message: {
                    type: "string",
                    description: "Error message",
                  },
                  details: {
                    type: "object",
                    description: "Additional error details",
                  },
                },
              },
              message: {
                type: "string",
                description: "Optional success message",
              },
              metadata: {
                type: "object",
                properties: {
                  timestamp: {
                    type: "string",
                    format: "date-time",
                    description: "Response timestamp",
                  },
                  version: {
                    type: "string",
                    description: "API version",
                  },
                  pagination: {
                    type: "object",
                    properties: {
                      page: { type: "integer" },
                      limit: { type: "integer" },
                      total: { type: "integer" },
                      hasMore: { type: "boolean" },
                    },
                  },
                },
              },
            },
          },
          ValidationError: {
            type: "object",
            properties: {
              field: {
                type: "string",
                description: "Field that failed validation",
              },
              message: {
                type: "string",
                description: "Validation error message",
              },
            },
          },
          ErrorResponse: {
            type: "object",
            properties: {
              success: {
                type: "boolean",
                enum: [false],
              },
              error: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  message: { type: "string" },
                  details: { type: "object" },
                },
                required: ["code", "message"],
              },
            },
            required: ["success", "error"],
          },
        },
        securitySchemes: {
          sessionAuth: {
            type: "apiKey",
            in: "cookie",
            name: "connect.sid",
            description: "Session-based authentication",
          },
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "JWT bearer token authentication",
          },
        },
        responses: {
          BadRequest: {
            description: "Bad request",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          Unauthorized: {
            description: "Authentication required",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          Forbidden: {
            description: "Access denied",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          NotFound: {
            description: "Resource not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          InternalError: {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    apis,
  };

  return swaggerJsdoc(options);
}

/**
 * Setup OpenAPI documentation UI
 * @param app Express application
 * @param config OpenAPI configuration
 * @param apis Array of file patterns for API routes
 * @param path Path to serve documentation (default: /api-docs)
 */
export function setupOpenAPIDocumentation(
  app: Express,
  config: OpenAPIConfig,
  apis: string[],
  path: string = "/api-docs",
): void {
  const swaggerSpec = generateOpenAPISpec(config, apis);

  // Serve OpenAPI spec as JSON
  app.get(`${path}/spec.json`, (_req, res) => {
    res.json(swaggerSpec);
  });

  // Serve Swagger UI
  app.use(
    path,
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: `${config.title} - API Documentation`,
      customfavIcon: "/favicon.ico",
      customCss: `
        .swagger-ui .topbar { display: none }
        .swagger-ui .info { margin-bottom: 40px }
        .swagger-ui .scheme-container { display: none }
      `,
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        docExpansion: "none",
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        displayOperationId: false,
      },
    }),
  );
}

/**
 * Example JSDoc annotation for OpenAPI
 *
 * @swagger
 * /api/resource:
 *   get:
 *     summary: Get all resources
 *     tags: [Resources]
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */

/**
 * OpenAPI operation decorator (for future TypeScript decorator support)
 */
export function ApiOperation(operation: any) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    // Store OpenAPI metadata for later processing
    if (!target._openapi) {
      target._openapi = {};
    }
    target._openapi[propertyKey] = operation;
    return descriptor;
  };
}
