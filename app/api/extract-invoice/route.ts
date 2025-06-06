import { type NextRequest, NextResponse } from "next/server"
import { HumanMessage } from "@langchain/core/messages"
import { ChatOpenAI } from "@langchain/openai"
import { z } from "zod"

// Define Shipping Order schema using Zod
const ShippingOrderSchema = z.object({
  OrderNumber: z.string().describe("Order or shipment number"),
  ShipDate: z.string().describe("Ship date"),
  DeliveryDate: z.string().optional().describe("Expected delivery date"),
  TrackingNumber: z.string().optional().describe("Tracking number"),
  Carrier: z.string().describe("Shipping carrier (UPS, FedEx, USPS, etc.)"),
  ShippingMethod: z.string().describe("Shipping method (Ground, Express, etc.)"),
  SenderName: z.string().describe("Sender name"),
  SenderAddress: z.string().describe("Sender address"),
  SenderCity: z.string().describe("Sender city"),
  SenderState: z.string().describe("Sender state"),
  SenderZip: z.string().describe("Sender ZIP code"),
  RecipientName: z.string().describe("Recipient name"),
  RecipientAddress: z.string().describe("Recipient address"),
  RecipientCity: z.string().describe("Recipient city"),
  RecipientState: z.string().describe("Recipient state"),
  RecipientZip: z.string().describe("Recipient ZIP code"),
  Weight: z.string().optional().describe("Package weight"),
  Dimensions: z.string().optional().describe("Package dimensions"),
  DeclaredValue: z.string().optional().describe("Declared value"),
  ShippingCost: z.string().optional().describe("Shipping cost"),
  BillingAccount: z.string().optional().describe("Billing account number"),
  SpecialInstructions: z.string().optional().describe("Special delivery instructions"),
  ServiceType: z.string().optional().describe("Service type or class"),
  Items: z.array(z.object({
    description: z.string().describe("Item description"),
    quantity: z.string().describe("Item quantity"),
    value: z.string().optional().describe("Item value")
  })).optional().describe("List of items being shipped")
})

export async function POST(request: NextRequest) {
  try {
    // Check if OpenAI API key is configured
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI API key is not configured" }, { status: 500 })
    }

    // Get form data from the request
    const formData = await request.formData()
    const imageFile = formData.get("image") as File

    if (!imageFile) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 })
    }

    // Convert image to base64
    const imageBuffer = await imageFile.arrayBuffer()
    const base64Image = Buffer.from(imageBuffer).toString("base64")

    // Initialize the LLM with structured output
    const llm = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0,
      maxTokens: 3000,
      apiKey: OPENAI_API_KEY,
    }).withStructuredOutput(ShippingOrderSchema)

    // Create the message with text and image
    const message = new HumanMessage({
      content: [
        {
          type: "text",
          text:
            "Extract the shipping order details from this image. " +
            "This appears to be a shipping order, shipping label, or delivery document. " +
            "Extract all available information including sender details, recipient details, " +
            "shipping information, tracking numbers, dates, costs, and any items listed. " +
            "If any field is not available or visible in the image, leave it empty. " +
            "For addresses, extract the complete address including street, city, state, and ZIP code. " +
            "Be very careful to extract the correct information and match it to the right fields. " +
            "Pay special attention to tracking numbers, order numbers, and shipping dates.",
        },
        {
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${base64Image}`,
          },
        },
      ],
    })

    // Process the image with LangChain
    const response = await llm.invoke([message])

    // Return the extracted data
    return NextResponse.json({
      success: true,
      data: response,
      extractedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error processing image:", error)

    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : "An unknown error occurred" 
      },
      { status: 500 },
    )
  }
} 