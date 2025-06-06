import { type NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Get the PDF file from the request
    const formData = await request.formData()
    const file = formData.get('pdf') as File

    if (!file) {
      return NextResponse.json({ error: 'No PDF file provided' }, { status: 400 })
    }

    // Check if ConvertAPI key is configured
    const CONVERTAPI_SECRET = process.env.CONVERTAPI_SECRET || '4FkbnBsk9bN53Gv5dtw4UmbuAIcGTg65'
    if (!CONVERTAPI_SECRET) {
      return NextResponse.json({ error: 'ConvertAPI secret is not configured' }, { status: 500 })
    }

    // Prepare form data for ConvertAPI
    const convertApiFormData = new FormData()
    convertApiFormData.append('File', file)

    // Call ConvertAPI to convert PDF to JPG
    const response = await fetch('https://v2.convertapi.com/convert/pdf/to/jpg', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONVERTAPI_SECRET}`,
      },
      body: convertApiFormData,
    })

    if (!response.ok) {
      throw new Error(`ConvertAPI error: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    // Print the response fields/structure
    console.log('ConvertAPI response fields:', Object.keys(result.Files[0]));

    // Process the ConvertAPI response
    if (!result.Files || !Array.isArray(result.Files)) {
      throw new Error('Invalid response from ConvertAPI')
    }

    const pageImages = []

    // Process each converted image
    for (let i = 0; i < result.Files.length; i++) {
      const fileInfo = result.Files[i]
      
      // Use the base64 data directly from FileData
      const imageDataUrl = `data:image/jpeg;base64,${fileInfo.FileData}`

      pageImages.push({
        pageNumber: i + 1,
        imageDataUrl,
        width: 800, // ConvertAPI doesn't provide dimensions, using default
        height: 1000,
        fileName: fileInfo.FileName,
        fileExt: fileInfo.FileExt,
        fileSize: fileInfo.FileSize,
      })
    }

    return NextResponse.json({
      success: true,
      totalPages: result.Files.length,
      pages: pageImages,
      conversionInfo: {
        conversionCost: result.ConversionCost,
      }
    })
  } catch (error) {
    console.error('Error processing PDF with ConvertAPI:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process PDF',
      },
      { status: 500 }
    )
  }
} 