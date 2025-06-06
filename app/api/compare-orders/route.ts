import { type NextRequest, NextResponse } from "next/server"
import { HumanMessage } from "@langchain/core/messages"
import { ChatOpenAI } from "@langchain/openai"
import { z } from "zod"

// Define Comparison Result schema
const ComparisonResultSchema = z.object({
  discrepancies: z.array(z.object({
    field: z.string().describe("The field name where discrepancy was found"),
    order1_value: z.string().describe("Value from the first order"),
    order2_value: z.string().describe("Value from the second order"),
    severity: z.enum(["critical", "major", "minor"]).describe("Severity of the discrepancy"),
    description: z.string().describe("Human-readable description of the discrepancy")
  })).describe("List of discrepancies found between the two orders"),
  
  matches: z.array(z.object({
    field: z.string().describe("The field name that matches"),
    value: z.string().describe("The matching value"),
    confidence: z.number().min(0).max(1).describe("Confidence that this is a correct match")
  })).describe("List of fields that match between orders"),
  
  analysis: z.object({
    overall_confidence: z.number().min(0).max(1).describe("Overall confidence in the comparison accuracy"),
    comparison_quality: z.enum(["excellent", "good", "fair", "poor"]).describe("Quality of the comparison"),
    potential_issues: z.array(z.string()).describe("Potential issues or concerns with the comparison"),
    recommendation: z.string().describe("Recommendation for next steps")
  }).describe("Overall analysis of the comparison"),
  
  summary: z.string().describe("Brief summary of the comparison results")
})

export async function POST(request: NextRequest) {
  try {
    // Check if OpenAI API key is configured
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI API key is not configured" }, { status: 500 })
    }

    // Get the extracted data from both orders
    const { order1, order2 } = await request.json()

    if (!order1 || !order2) {
      return NextResponse.json({ error: "Both order1 and order2 data are required" }, { status: 400 })
    }

    // Initialize the LLM with structured output
    const llm = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0,
      maxTokens: 4000,
      apiKey: OPENAI_API_KEY,
    }).withStructuredOutput(ComparisonResultSchema)

    // Create the comparison prompt
    const message = new HumanMessage({
      content: [
        {
          type: "text",
          text: `
            You are an expert shipping order analyst. Please compare these two shipping orders and identify any discrepancies or differences.

            SHIPPING ORDER 1:
            ${JSON.stringify(order1, null, 2)}

            SHIPPING ORDER 2:
            ${JSON.stringify(order2, null, 2)}

            Please analyze these orders carefully and provide:

            1. DISCREPANCIES: Any differences between the orders, categorized by severity:
               - CRITICAL: Different recipients, addresses, or tracking numbers that could cause delivery failures
               - MAJOR: Different carriers, shipping methods, dates, or costs that significantly impact the shipment
               - MINOR: Small differences in formatting, optional fields, or non-critical information

            2. MATCHES: Fields that are identical or substantially similar between both orders

            3. ANALYSIS: Overall assessment including:
               - Confidence score (0.0 to 1.0) representing how confident you are in this comparison
               - Quality assessment of the comparison
               - Any potential issues or concerns
               - Recommendation for next steps

            4. SUMMARY: Brief overview of the comparison results

            IMPORTANT GUIDELINES:
            - Pay special attention to critical shipping information (addresses, recipients, tracking numbers)
            - Consider variations in formatting (e.g., "123 Main St" vs "123 Main Street") as minor if the meaning is the same
            - Assign higher confidence scores when the data is clear and complete
            - Assign lower confidence scores when data is missing, unclear, or potentially extracted incorrectly
            - If confidence is below 0.8, recommend manual review
            - Consider empty/missing fields carefully - they might indicate incomplete extraction rather than actual differences
          `,
        },
      ],
    })

    // Process the comparison with LangChain
    const response = await llm.invoke([message])

    // Add warning flag if confidence is below 0.8
    const needsManualReview = response.analysis.overall_confidence < 0.8

    // Return the comparison results
    return NextResponse.json({
      success: true,
      comparison: response,
      needsManualReview,
      comparedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error comparing orders:", error)

    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : "An unknown error occurred during comparison" 
      },
      { status: 500 },
    )
  }
} 