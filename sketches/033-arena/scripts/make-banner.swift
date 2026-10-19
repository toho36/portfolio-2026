// Usage: swift make-banner.swift <logo.png> <out.png>
// Draws the arena banner texture: navy canvas, pixel logo (nearest), "gameonvb.cz".
import AppKit
let args = CommandLine.arguments
let W = 1400, H = 1100
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: W, pixelsHigh: H, bitsPerSample: 8,
  samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
let ctx = NSGraphicsContext(bitmapImageRep: rep)!
NSGraphicsContext.current = ctx
ctx.imageInterpolation = .none
NSColor(srgbRed: 0.043, green: 0.024, blue: 0.19, alpha: 1).setFill()
NSRect(x: 0, y: 0, width: W, height: H).fill()
let logo = NSImage(contentsOfFile: args[1])!
logo.draw(in: NSRect(x: (W-680)/2, y: H-90-680, width: 680, height: 680))
let font = NSFont(name: "Arial Black", size: 170) ?? NSFont.boldSystemFont(ofSize: 170)
let text = NSAttributedString(string: "gameonvb.cz", attributes: [.font: font, .foregroundColor: NSColor.white])
let size = text.size()
text.draw(at: NSPoint(x: (CGFloat(W)-size.width)/2, y: 70))
NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: args[2]))
