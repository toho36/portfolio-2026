// Parent-only, headless AppKit export. Does not launch Screen Switch or create UI.
// swift export-screen-switch-icon.swift /absolute/run-folder/rectangle.2.swap.png
import AppKit
import Foundation

enum ExportFailure: Error {
    case usage, missingSymbol, bitmap, graphicsContext, png
}

guard CommandLine.arguments.count == 2 else { throw ExportFailure.usage }
let destination = URL(fileURLWithPath: CommandLine.arguments[1])
guard destination.pathExtension.lowercased() == "png" else { throw ExportFailure.usage }
guard let original = NSImage(systemSymbolName: "rectangle.2.swap", accessibilityDescription: nil),
      let symbol = original.withSymbolConfiguration(.init(pointSize: 72, weight: .regular)) else {
    throw ExportFailure.missingSymbol
}
symbol.isTemplate = false
guard let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 128, pixelsHigh: 128,
                                   bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true,
                                   isPlanar: false, colorSpaceName: .deviceRGB,
                                   bytesPerRow: 0, bitsPerPixel: 0) else { throw ExportFailure.bitmap }
guard let context = NSGraphicsContext(bitmapImageRep: bitmap) else { throw ExportFailure.graphicsContext }
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = context
context.cgContext.clear(CGRect(x: 0, y: 0, width: 128, height: 128))
context.imageInterpolation = .high
NSColor.black.set()
let ratio = min(112 / symbol.size.width, 112 / symbol.size.height)
let size = NSSize(width: symbol.size.width * ratio, height: symbol.size.height * ratio)
symbol.draw(in: NSRect(x: (128-size.width)/2, y: (128-size.height)/2,
                      width: size.width, height: size.height),
            from: .zero, operation: .sourceOver, fraction: 1)
context.flushGraphics()
NSGraphicsContext.restoreGraphicsState()
guard let png = bitmap.representation(using: .png, properties: [:]) else { throw ExportFailure.png }
// Refuse an accidental overwrite of any existing proof or original asset.
try png.write(to: destination, options: .withoutOverwriting)
print("Exported installed SF Symbol rectangle.2.swap: \(destination.path)")
