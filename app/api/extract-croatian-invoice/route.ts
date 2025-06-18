import { type NextRequest, NextResponse } from "next/server"
import { HumanMessage } from "@langchain/core/messages"
import { ChatOpenAI } from "@langchain/openai"
import { z } from "zod"

// Define Croatian Invoice schema using Zod
const CroatianInvoiceSchema = z.object({
  // Invoice Details
  invoiceNumber: z.string().describe("Broj računa"),
  issuePlace: z.string().describe("Mjesto, datum i vrijeme izdavanja"),
  dueDate: z.string().describe("Dospijeće plaćanja"),
  deliveryDate: z.string().describe("Datum isporuke"),
  
  // Seller Information
  sellerName: z.string().describe("Naziv tvrtke izdavatelja"),
  sellerStreet: z.string().describe("Ulica izdavatelja"),
  sellerCity: z.string().describe("Grad izdavatelja"),
  sellerOIB: z.string().describe("OIB izdavatelja"),
  ownerName: z.string().describe("Vlasnik/Direktor"),
  fullAddress: z.string().describe("Puna adresa za footer"),
  iban: z.string().describe("IBAN"),
  bankName: z.string().describe("Naziv banke"),
  
  // Buyer Information
  buyerName: z.string().describe("Naziv tvrtke/ime kupca"),
  buyerStreet: z.string().describe("Ulica kupca"),
  buyerCity: z.string().describe("Grad kupca"),
  buyerOIB: z.string().describe("OIB kupca"),
  buyerContact: z.string().describe("Kontakt osoba"),
  buyerEmail: z.string().describe("Email kupca"),
  
  // Item Information
  item1Description: z.string().describe("Opis proizvoda/usluge"),
  item1Unit: z.string().describe("Jedinica mjere"),
  item1Quantity: z.number().describe("Količina"),
  item1Price: z.number().describe("Cijena"),
  item1Discount: z.number().describe("Rabat u postocima"),
  item1Total: z.number().describe("Ukupno"),
  
  // Payment and totals
  totalAmount: z.number().describe("Ukupni iznos"),
  currency: z.string().describe("Valuta"),
  paymentMethod: z.string().describe("Način plaćanja"),
  issuedBy: z.string().describe("Račun ispostavio"),
  operatorSign: z.string().describe("Oznaka operatera"),
  paymentReference: z.string().describe("Poziv na broj"),
  vatNote: z.string().describe("Napomena o PDV-u")
})

// CORS headers configuration
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Change this to your specific domain in production
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
}

// Handle preflight OPTIONS request
export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  })
}

export async function POST(request: NextRequest) {
  try {
    // Check if OpenAI API key is configured
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured" }, 
        { 
          status: 500,
          headers: corsHeaders,
        }
      )
    }

    // Get JSON data from the request
    const body = await request.json()
    const { text } = body

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: "No text input provided" }, 
        { 
          status: 400,
          headers: corsHeaders,
        }
      )
    }

    // Initialize the LLM with structured output
    const llm = new ChatOpenAI({
      modelName: "gpt-4.1-mini",
      temperature: 0,
      maxTokens: 3000,
      apiKey: OPENAI_API_KEY,
    }).withStructuredOutput(CroatianInvoiceSchema)

    // Create the message with text content
    const message = new HumanMessage({
      content: [
        {
          type: "text",
          text:
            "Extract the Croatian invoice details from this text. " +
            "This appears to be a Croatian invoice or billing document. " +
            "Extract all available information including invoice details, seller information, " +
            "buyer information, item details, payment information, and totals. " +
            "If any field is not available in the text, leave it empty. " +
            "Pay special attention to Croatian-specific fields like OIB numbers, IBAN, " +
            "and Croatian language terms. Here is the text content:\n\n" + text,
        },
      ],
    })

    // Process the text with LangChain
    const response = await llm.invoke([message])

    // Return the extracted data with CORS headers
    return NextResponse.json(
      {
        success: true,
        data: response,
        extractedAt: new Date().toISOString(),
      },
      {
        headers: corsHeaders,
      }
    )
  } catch (error) {
    console.error("Error processing text:", error)

    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : "An unknown error occurred" 
      },
      { 
        status: 500,
        headers: corsHeaders,
      },
    )
  }
} 