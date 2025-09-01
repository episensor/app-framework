# AI Service Integration Guide

This guide explains how to integrate AI capabilities into your application using the framework's AI service. The pattern involves creating an application-specific adapter that manages prompts and context while leveraging the framework's generic AI service.

## Table of Contents

- [Quick Start](#quick-start)
- [Application-Specific AI Adapter Pattern](#application-specific-ai-adapter-pattern)
- [Prompt Management](#prompt-management)
- [Advanced Usage](#advanced-usage)
- [Best Practices](#best-practices)

## Quick Start

### 1. Configure the AI Service

In your application's startup code:

```typescript
// src/server.ts
import { AIService } from '@episensor/app-framework/services';

const aiService = new AIService();

// Register OpenAI provider
aiService.registerProvider('openai', {
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4-turbo'
});

// Set as default
aiService.setDefaultProvider('openai');

export { aiService };
```

### 2. Basic Usage

```typescript
// Simple analysis
const response = await aiService.analyze('Explain renewable energy benefits', {
  systemPrompt: 'You are an energy expert.',
  temperature: 0.3
});

console.log(response.content);
```

## Application-Specific AI Adapter Pattern

For complex applications, create an adapter service that manages your specific AI interactions:

### 1. Create Prompt Templates

```typescript
// src/ai/prompts.ts
export const DEVICE_ANALYSIS_PROMPT = `
You are an expert in IoT device analysis. Analyze the following device data and provide insights.

Device Type: {{deviceType}}
Current Status: {{status}}
Data Points: {{dataPoints}}

Provide:
1. Overall health assessment
2. Any anomalies or concerns
3. Recommended actions
4. Predicted trends

Format your response as JSON with the structure:
{
  "health": "excellent|good|fair|poor|critical",
  "anomalies": ["list of issues"],
  "recommendations": ["list of actions"],
  "trends": "description of predicted trends"
}
`;

export const OPTIMIZATION_PROMPT = `
You are an energy optimization specialist. Given the following system parameters, suggest optimizations.

System Data:
{{systemData}}

Historical Performance:
{{historicalData}}

Constraints:
{{constraints}}

Provide specific, actionable optimization recommendations with expected impact.
`;

export const REPORT_GENERATION_PROMPT = `
Generate a comprehensive report based on the following data:

Data Summary: {{dataSummary}}
Time Period: {{timePeriod}}
Key Metrics: {{keyMetrics}}

Create a professional report with:
- Executive Summary
- Key Findings
- Detailed Analysis
- Recommendations
- Appendix with raw data

Format in markdown.
`;
```

### 2. Create Application AI Service

```typescript
// src/services/appAiService.ts
import { aiService } from '../server';
import { 
  DEVICE_ANALYSIS_PROMPT, 
  OPTIMIZATION_PROMPT, 
  REPORT_GENERATION_PROMPT 
} from '../ai/prompts';

export interface DeviceAnalysisResult {
  health: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  anomalies: string[];
  recommendations: string[];
  trends: string;
}

export interface OptimizationSuggestion {
  category: string;
  suggestion: string;
  expectedImpact: string;
  implementation: string;
}

export class AppAiService {
  constructor(private ai = aiService) {}

  /**
   * Analyze device performance and health
   */
  async analyzeDevice(
    deviceType: string,
    status: any,
    dataPoints: Record<string, any>
  ): Promise<DeviceAnalysisResult> {
    const prompt = this.fillTemplate(DEVICE_ANALYSIS_PROMPT, {
      deviceType,
      status: JSON.stringify(status),
      dataPoints: JSON.stringify(dataPoints, null, 2)
    });

    const response = await this.ai.analyze(prompt, {
      systemPrompt: 'You are a device monitoring expert. Always respond with valid JSON.',
      temperature: 0.2,
      useCache: true // Cache results for similar device states
    });

    try {
      return JSON.parse(response.content);
    } catch (error) {
      throw new Error(`Failed to parse AI response: ${error.message}`);
    }
  }

  /**
   * Generate optimization suggestions
   */
  async generateOptimizations(
    systemData: any,
    historicalData: any,
    constraints: string[]
  ): Promise<OptimizationSuggestion[]> {
    const prompt = this.fillTemplate(OPTIMIZATION_PROMPT, {
      systemData: JSON.stringify(systemData, null, 2),
      historicalData: JSON.stringify(historicalData, null, 2),
      constraints: constraints.join('\n- ')
    });

    const response = await this.ai.analyze(prompt, {
      systemPrompt: 'You are an optimization expert focused on practical, implementable solutions.',
      temperature: 0.4
    });

    // Parse and structure the response
    return this.parseOptimizations(response.content);
  }

  /**
   * Generate comprehensive reports
   */
  async generateReport(
    dataSummary: any,
    timePeriod: string,
    keyMetrics: Record<string, any>
  ): Promise<string> {
    const prompt = this.fillTemplate(REPORT_GENERATION_PROMPT, {
      dataSummary: JSON.stringify(dataSummary, null, 2),
      timePeriod,
      keyMetrics: JSON.stringify(keyMetrics, null, 2)
    });

    const response = await this.ai.analyze(prompt, {
      systemPrompt: 'You are a technical report writer. Create clear, professional reports.',
      temperature: 0.3,
      maxTokens: 2000
    });

    return response.content;
  }

  /**
   * Interactive chat for troubleshooting
   */
  async troubleshootDevice(
    conversationHistory: Array<{role: 'user' | 'assistant', content: string}>,
    deviceContext: any
  ): Promise<string> {
    const systemMessage = `
You are a device troubleshooting assistant. Help diagnose and resolve issues.

Device Context:
${JSON.stringify(deviceContext, null, 2)}

Be specific, actionable, and ask follow-up questions when needed.
    `;

    const messages = [
      { role: 'system', content: systemMessage },
      ...conversationHistory
    ];

    const response = await this.ai.chat(messages as any, {
      temperature: 0.5,
      maxTokens: 500
    });

    return response.content;
  }

  /**
   * Template filling utility
   */
  private fillTemplate(template: string, variables: Record<string, string>): string {
    let result = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value);
    }
    
    return result;
  }

  /**
   * Parse optimization suggestions from AI response
   */
  private parseOptimizations(content: string): OptimizationSuggestion[] {
    // Implementation would parse the AI response and structure it
    // This is a simplified example
    const lines = content.split('\n').filter(line => line.trim());
    const suggestions: OptimizationSuggestion[] = [];
    
    // Parse based on your expected AI response format
    // Add actual parsing logic here
    
    return suggestions;
  }
}

// Export singleton instance
export const appAiService = new AppAiService();
```

### 3. Use in Your Application

```typescript
// src/routes/devices.ts
import { Router } from 'express';
import { validate } from '@episensor/app-framework/middleware';
import { z } from 'zod';
import { appAiService } from '../services/appAiService';

const router = Router();

const deviceAnalysisSchema = z.object({
  deviceType: z.string(),
  status: z.any(),
  dataPoints: z.record(z.any())
});

router.post('/devices/:id/analyze', 
  validate(deviceAnalysisSchema),
  async (req, res) => {
    try {
      const { deviceType, status, dataPoints } = req.body;
      
      const analysis = await appAiService.analyzeDevice(
        deviceType,
        status,
        dataPoints
      );
      
      res.json({
        success: true,
        data: analysis
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

export default router;
```

## Advanced Usage

### Streaming Responses

For long-running AI tasks, use streaming:

```typescript
// src/services/streamingAiService.ts
export class StreamingAiService {
  async streamReport(
    prompt: string,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    // Note: This is a conceptual example
    // The current framework doesn't support streaming yet
    // but this shows the pattern for when it's added
    
    const response = await aiService.analyze(prompt, {
      stream: true,
      onChunk: (chunk) => {
        onChunk(chunk);
      }
    });
  }
}
```

### Context Management

For applications that need to maintain conversation context:

```typescript
// src/services/contextManager.ts
export class AIContextManager {
  private contexts = new Map<string, Array<{role: string, content: string}>>();
  private maxContextLength = 10; // Maximum messages to keep

  addToContext(sessionId: string, role: 'user' | 'assistant', content: string): void {
    if (!this.contexts.has(sessionId)) {
      this.contexts.set(sessionId, []);
    }
    
    const context = this.contexts.get(sessionId)!;
    context.push({ role, content });
    
    // Keep only recent messages
    if (context.length > this.maxContextLength) {
      context.splice(0, context.length - this.maxContextLength);
    }
  }

  getContext(sessionId: string): Array<{role: string, content: string}> {
    return this.contexts.get(sessionId) || [];
  }

  clearContext(sessionId: string): void {
    this.contexts.delete(sessionId);
  }
}
```

### Error Handling and Retries

```typescript
// src/services/robustAiService.ts
export class RobustAiService {
  async analyzeWithRetry<T>(
    prompt: string,
    parser: (content: string) => T,
    maxRetries = 3
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await aiService.analyze(prompt, {
          temperature: 0.1, // Lower temperature for more consistent responses
          maxTokens: 1000
        });
        
        return parser(response.content);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries) {
          // Wait before retry with exponential backoff
          await new Promise(resolve => 
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }
    
    throw new Error(`AI analysis failed after ${maxRetries} attempts: ${lastError!.message}`);
  }
}
```

## Best Practices

### 1. Prompt Engineering
- **Be specific** - Include exact format requirements
- **Provide context** - Give the AI relevant background information
- **Use examples** - Show the AI what good output looks like
- **Set constraints** - Specify length, format, and content boundaries

### 2. Caching Strategy
- **Enable caching** for repeated queries with `useCache: true`
- **Use consistent inputs** to maximize cache hits
- **Clear cache periodically** to avoid stale responses

### 3. Error Handling
- **Parse responses safely** - AI output isn't always valid JSON
- **Implement fallbacks** - Have default responses for failures
- **Log failures** - Track what prompts cause issues
- **Validate outputs** - Check AI responses meet your requirements

### 4. Performance
- **Use appropriate models** - GPT-4 for complex tasks, GPT-3.5 for simple ones
- **Set reasonable token limits** - Prevent excessive costs
- **Batch similar requests** - Group related AI calls when possible
- **Monitor usage** - Track costs and performance

### 5. Security
- **Sanitize inputs** - Clean user input before sending to AI
- **Validate outputs** - Don't trust AI responses blindly
- **Protect sensitive data** - Don't send confidential information to external AI services
- **Use appropriate system prompts** - Guide AI behavior with security in mind

### 6. Testing
- **Test with real data** - Use actual application data in tests
- **Mock AI responses** - For unit tests, mock the AI service
- **Monitor output quality** - Regularly review AI outputs for accuracy
- **A/B test prompts** - Compare different prompt versions

This pattern ensures your application's AI integration is robust, maintainable, and provides consistent value to your users.