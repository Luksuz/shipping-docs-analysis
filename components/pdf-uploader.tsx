'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, FileText, Image, Loader2, CheckCircle, AlertCircle, AlertTriangle, Eye, EyeOff, GitCompare } from 'lucide-react'

interface PageImage {
  pageNumber: number
  imageDataUrl: string
  selected: boolean
  width?: number
  height?: number
}

interface ExtractedData {
  success: boolean
  data?: any
  error?: string
  extractedAt?: string
  pageNumber?: number
}

interface ComparisonResult {
  success: boolean
  comparison?: {
    discrepancies: Array<{
      field: string
      order1_value: string
      order2_value: string
      severity: 'critical' | 'major' | 'minor'
      description: string
    }>
    matches: Array<{
      field: string
      value: string
      confidence: number
    }>
    analysis: {
      overall_confidence: number
      comparison_quality: 'excellent' | 'good' | 'fair' | 'poor'
      potential_issues: string[]
      recommendation: string
    }
    summary: string
  }
  needsManualReview?: boolean
  comparedAt?: string
  error?: string
}

interface PdfData {
  file: File | null
  pageImages: PageImage[]
  loading: boolean
  extractedData: ExtractedData[]
  processing: boolean
}

export function PdfUploader() {
  const [pdf1, setPdf1] = useState<PdfData>({
    file: null,
    pageImages: [],
    loading: false,
    extractedData: [],
    processing: false
  })
  
  const [pdf2, setPdf2] = useState<PdfData>({
    file: null,
    pageImages: [],
    loading: false,
    extractedData: [],
    processing: false
  })

  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null)
  const [comparing, setComparing] = useState(false)
  const [showExtractedData, setShowExtractedData] = useState(false)

  const fileInput1Ref = useRef<HTMLInputElement>(null)
  const fileInput2Ref = useRef<HTMLInputElement>(null)

  const processPdf = useCallback(async (selectedFile: File, pdfNumber: 1 | 2) => {
    if (!selectedFile || selectedFile.type !== 'application/pdf') {
      alert('Please select a valid PDF file')
      return
    }

    const setPdfData = pdfNumber === 1 ? setPdf1 : setPdf2

    setPdfData(prev => ({ ...prev, file: selectedFile, loading: true, pageImages: [], extractedData: [] }))

    try {
      // Send PDF to server for processing
      const formData = new FormData()
      formData.append('pdf', selectedFile)

      const response = await fetch('/api/process-pdf', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (result.success) {
        // Convert server response to PageImage format
        const images: PageImage[] = result.pages.map((page: any) => ({
          pageNumber: page.pageNumber,
          imageDataUrl: page.imageDataUrl,
          selected: false,
          width: page.width,
          height: page.height,
        }))
        setPdfData(prev => ({ ...prev, pageImages: images, loading: false }))
      } else {
        throw new Error(result.error || 'Failed to process PDF')
      }
    } catch (error) {
      console.error('Error processing PDF:', error)
      alert('Error processing PDF. Please try again.')
      setPdfData(prev => ({ ...prev, loading: false }))
    }
  }, [])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, pdfNumber: 1 | 2) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile) {
      processPdf(selectedFile, pdfNumber)
    }
  }

  const togglePageSelection = (pageNumber: number, pdfNumber: 1 | 2) => {
    const setPdfData = pdfNumber === 1 ? setPdf1 : setPdf2
    setPdfData(prev => ({
      ...prev,
      pageImages: prev.pageImages.map(img =>
        img.pageNumber === pageNumber
          ? { ...img, selected: !img.selected }
          : img
      )
    }))
  }

  const selectAllPages = (pdfNumber: 1 | 2) => {
    const setPdfData = pdfNumber === 1 ? setPdf1 : setPdf2
    setPdfData(prev => ({ 
      ...prev, 
      pageImages: prev.pageImages.map(img => ({ ...img, selected: true })) 
    }))
  }

  const deselectAllPages = (pdfNumber: 1 | 2) => {
    const setPdfData = pdfNumber === 1 ? setPdf1 : setPdf2
    setPdfData(prev => ({ 
      ...prev, 
      pageImages: prev.pageImages.map(img => ({ ...img, selected: false })) 
    }))
  }

  const processSelectedImages = async (pdfNumber: 1 | 2) => {
    const pdfData = pdfNumber === 1 ? pdf1 : pdf2
    const setPdfData = pdfNumber === 1 ? setPdf1 : setPdf2
    
    const selectedImages = pdfData.pageImages.filter(img => img.selected)
    
    if (selectedImages.length === 0) {
      alert('Please select at least one page to process')
      return
    }

    setPdfData(prev => ({ ...prev, processing: true }))
    const results: ExtractedData[] = []

    for (const imageData of selectedImages) {
      try {
        // Convert data URL to blob
        const response = await fetch(imageData.imageDataUrl)
        const blob = await response.blob()
        
        // Create form data
        const formData = new FormData()
        formData.append('image', blob, `page-${imageData.pageNumber}.jpg`)

        // Send to API
        const apiResponse = await fetch('/api/extract-invoice', {
          method: 'POST',
          body: formData,
        })

        const result = await apiResponse.json()
        results.push({
          ...result,
          pageNumber: imageData.pageNumber,
        })
      } catch (error) {
        console.error(`Error processing page ${imageData.pageNumber}:`, error)
        results.push({
          success: false,
          error: `Failed to process page ${imageData.pageNumber}`,
          pageNumber: imageData.pageNumber,
        })
      }
    }

    setPdfData(prev => ({ ...prev, extractedData: results, processing: false }))
  }

  const compareOrders = async () => {
    // Get the first successful extraction from each PDF
    const order1Data = pdf1.extractedData.find(result => result.success)?.data
    const order2Data = pdf2.extractedData.find(result => result.success)?.data

    if (!order1Data || !order2Data) {
      alert('Please ensure both PDFs have been processed and have successful extractions before comparing.')
      return
    }

    setComparing(true)
    setComparisonResult(null)

    try {
      const response = await fetch('/api/compare-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order1: order1Data,
          order2: order2Data,
        }),
      })

      const result = await response.json()
      setComparisonResult(result)
    } catch (error) {
      console.error('Error comparing orders:', error)
      setComparisonResult({
        success: false,
        error: 'Failed to compare orders. Please try again.'
      })
    } finally {
      setComparing(false)
    }
  }

  const getSeverityColor = (severity: 'critical' | 'major' | 'minor') => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50'
      case 'major': return 'text-orange-600 bg-orange-50'
      case 'minor': return 'text-yellow-600 bg-yellow-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getSeverityIcon = (severity: 'critical' | 'major' | 'minor') => {
    switch (severity) {
      case 'critical': return <AlertCircle className="h-4 w-4" />
      case 'major': return <AlertTriangle className="h-4 w-4" />
      case 'minor': return <AlertCircle className="h-4 w-4" />
    }
  }

  const renderPdfSection = (pdfData: PdfData, pdfNumber: 1 | 2, title: string) => (
    <Card className="flex-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
          {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
          <Label htmlFor={`pdf-upload-${pdfNumber}`}>Select PDF file</Label>
            <div className="flex items-center gap-4">
              <Input
              id={`pdf-upload-${pdfNumber}`}
                type="file"
                accept=".pdf"
              onChange={(e) => handleFileChange(e, pdfNumber)}
              ref={pdfNumber === 1 ? fileInput1Ref : fileInput2Ref}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              />
            {pdfData.file && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                {pdfData.file.name}
                </div>
              )}
            </div>
          </div>

        {pdfData.loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Converting PDF to images...</span>
            </div>
          )}

        {pdfData.pageImages.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Image className="h-4 w-4" />
                <span className="text-sm">Pages ({pdfData.pageImages.length})</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => selectAllPages(pdfNumber)}>
                  Select All
                </Button>
                <Button size="sm" variant="outline" onClick={() => deselectAllPages(pdfNumber)}>
                  None
                </Button>
                <Button 
                  size="sm" 
                  onClick={() => processSelectedImages(pdfNumber)}
                  disabled={pdfData.processing || pdfData.pageImages.filter(img => img.selected).length === 0}
                >
                  {pdfData.processing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    'Extract'
                  )}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {pdfData.pageImages.map((image) => (
                <div
                  key={image.pageNumber}
                  className={`relative border-2 rounded-lg overflow-hidden cursor-pointer transition-all ${
                    image.selected 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => togglePageSelection(image.pageNumber, pdfNumber)}
                >
                  <div className="aspect-[3/4] relative">
                    <img
                      src={image.imageDataUrl}
                      alt={`Page ${image.pageNumber}`}
                      className="w-full h-full object-contain"
                    />
                    {image.selected && (
                      <div className="absolute top-1 right-1">
                        <CheckCircle className="h-4 w-4 text-primary bg-background rounded-full" />
                      </div>
                    )}
                  </div>
                  <div className="p-1 text-center">
                    <span className="text-xs font-medium">Page {image.pageNumber}</span>
                  </div>
                </div>
              ))}
            </div>

            {pdfData.extractedData.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-2">
                  {pdfData.extractedData.some(r => r.success) ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm font-medium">
                    Extraction {pdfData.extractedData.some(r => r.success) ? 'Complete' : 'Failed'}
                  </span>
                  {pdfData.extractedData.some(r => r.success) && (
                    <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                      ✓ Ready for comparison
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* File Upload Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderPdfSection(pdf1, 1, "Shipping Order #1")}
        {renderPdfSection(pdf2, 2, "Shipping Order #2")}
      </div>

      {/* Comparison Section */}
      {pdf1.extractedData.some(r => r.success) && pdf2.extractedData.some(r => r.success) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitCompare className="h-5 w-5" />
              Compare Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Button 
                onClick={compareOrders}
                disabled={comparing}
                className="flex items-center gap-2"
              >
                {comparing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Comparing...
                  </>
                ) : (
                  <>
                    <GitCompare className="h-4 w-4" />
                    Compare Orders
                  </>
                )}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExtractedData(!showExtractedData)}
                className="flex items-center gap-2"
              >
                {showExtractedData ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showExtractedData ? 'Hide' : 'Show'} Extracted Data
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Extracted Data Section */}
      {showExtractedData && (pdf1.extractedData.length > 0 || pdf2.extractedData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {pdf1.extractedData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Order #1 - Extracted Data</CardTitle>
              </CardHeader>
              <CardContent>
                {pdf1.extractedData.map((result, index) => (
                  <div key={index} className="border rounded-lg p-3 mb-2">
                    <div className="flex items-center gap-2 mb-2">
                      {result.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-sm font-medium">Page {result.pageNumber}</span>
                    </div>
                    {result.success ? (
                      <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-48">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    ) : (
                      <div className="text-red-500 text-sm">Error: {result.error}</div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {pdf2.extractedData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Order #2 - Extracted Data</CardTitle>
              </CardHeader>
              <CardContent>
                {pdf2.extractedData.map((result, index) => (
                  <div key={index} className="border rounded-lg p-3 mb-2">
                    <div className="flex items-center gap-2 mb-2">
                      {result.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-sm font-medium">Page {result.pageNumber}</span>
                    </div>
                    {result.success ? (
                      <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-48">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    ) : (
                      <div className="text-red-500 text-sm">Error: {result.error}</div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Comparison Results */}
      {comparisonResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitCompare className="h-5 w-5" />
              Comparison Results
              {comparisonResult.needsManualReview && (
                <div className="flex items-center gap-2 ml-auto">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  <span className="text-orange-600 bg-orange-50 px-3 py-1 rounded text-sm font-medium">
                    Manual Review Required
                  </span>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {comparisonResult.success && comparisonResult.comparison ? (
              <>
                {/* Summary and Confidence */}
                <div className="bg-muted p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Summary</h3>
                  <p className="text-sm mb-3">{comparisonResult.comparison.summary}</p>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Confidence Score:</span>
                      <span className={`text-sm font-bold ${
                        comparisonResult.comparison.analysis.overall_confidence >= 0.8 
                          ? 'text-green-600' 
                          : 'text-orange-600'
                      }`}>
                        {(comparisonResult.comparison.analysis.overall_confidence * 100).toFixed(1)}%
                    </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Quality:</span>
                      <span className="text-sm">{comparisonResult.comparison.analysis.comparison_quality}</span>
                    </div>
                  </div>
                </div>
                
                {/* Manual Review Warning */}
                {comparisonResult.needsManualReview && (
                  <div className="bg-orange-50 border-l-4 border-orange-400 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                      <h3 className="font-semibold text-orange-800">Manual Review Required</h3>
                    </div>
                    <p className="text-orange-700 text-sm mb-2">
                      The confidence score is below 80%. Please manually review the comparison results and extracted data for accuracy.
                    </p>
                    <p className="text-orange-700 text-sm font-medium">
                      Recommendation: {comparisonResult.comparison.analysis.recommendation}
                    </p>
                  </div>
                )}

                {/* Discrepancies */}
                {comparisonResult.comparison.discrepancies.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-red-500" />
                      Discrepancies Found ({comparisonResult.comparison.discrepancies.length})
                    </h3>
                    <div className="space-y-3">
                      {comparisonResult.comparison.discrepancies.map((discrepancy, index) => (
                        <div key={index} className={`border rounded-lg p-3 ${getSeverityColor(discrepancy.severity)}`}>
                          <div className="flex items-center gap-2 mb-2">
                            {getSeverityIcon(discrepancy.severity)}
                            <span className="font-medium text-sm">{discrepancy.field}</span>
                            <span className={`text-xs px-2 py-1 rounded uppercase font-medium ${getSeverityColor(discrepancy.severity)}`}>
                              {discrepancy.severity}
                            </span>
                          </div>
                          <p className="text-sm mb-2">{discrepancy.description}</p>
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                              <span className="font-medium">Order #1:</span>
                              <div className="bg-white/50 p-2 rounded mt-1">{discrepancy.order1_value}</div>
                            </div>
                            <div>
                              <span className="font-medium">Order #2:</span>
                              <div className="bg-white/50 p-2 rounded mt-1">{discrepancy.order2_value}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Matches */}
                {comparisonResult.comparison.matches.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      Matching Fields ({comparisonResult.comparison.matches.length})
                    </h3>
                    <div className="bg-green-50 rounded-lg p-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {comparisonResult.comparison.matches.map((match, index) => (
                          <div key={index} className="bg-white rounded p-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">{match.field}</span>
                              <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                                {(match.confidence * 100).toFixed(0)}%
                              </span>
                            </div>
                            <div className="text-xs text-gray-600 truncate">{match.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Potential Issues */}
                {comparisonResult.comparison.analysis.potential_issues.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      Potential Issues
                    </h3>
                    <div className="bg-yellow-50 rounded-lg p-3">
                      <ul className="list-disc list-inside space-y-1">
                        {comparisonResult.comparison.analysis.potential_issues.map((issue, index) => (
                          <li key={index} className="text-sm text-yellow-800">{issue}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                <div className="text-xs text-muted-foreground text-center">
                  Comparison completed at {comparisonResult.comparedAt ? new Date(comparisonResult.comparedAt).toLocaleString() : 'Unknown time'}
                </div>
              </>
            ) : (
              <div className="text-red-500 text-center py-4">
                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                <div className="font-medium">Comparison Failed</div>
                <div className="text-sm">{comparisonResult.error || 'An unknown error occurred'}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
} 