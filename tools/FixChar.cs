using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
class FixChar {
  static void Main() {
    var src = new Bitmap(@"C:\Users\dufala.DESKTOP-28S4BRA\草原\assets\ui\help-card.png");
    var bd = src.LockBits(new Rectangle(0,0,src.Width,src.Height), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
    int stride = bd.Stride;
    byte[] pix = new byte[stride * src.Height];
    Marshal.Copy(bd.Scan0, pix, 0, pix.Length);
    // cover the old 大 by copying the paper row just above it
    int x0 = 474, x1 = 502, y0 = 438, y1 = 466;
    for (int y = y0; y <= y1; y++) {
      int srcY = 428;
      for (int x = x0; x <= x1; x++) {
        int di = y * stride + x * 4;
        int si = srcY * stride + x * 4;
        pix[di] = pix[si]; pix[di+1] = pix[si+1]; pix[di+2] = pix[si+2]; pix[di+3] = 255;
      }
    }
    Marshal.Copy(pix, 0, bd.Scan0, pix.Length);
    src.UnlockBits(bd);
    using (var g = Graphics.FromImage(src)) {
      g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.AntiAliasGridFit;
      var font = new Font("YouYuan", 24, FontStyle.Bold, GraphicsUnit.Pixel);
      var brush = new SolidBrush(Color.FromArgb(255, 74, 42, 28));
      var sf = new StringFormat();
      sf.Alignment = StringAlignment.Center;
      sf.LineAlignment = StringAlignment.Center;
      g.DrawString("犬", font, brush, new RectangleF(470, 434, 36, 34), sf);
    }
    src.Save(@"C:\Users\dufala.DESKTOP-28S4BRA\草原\assets\ui\help-card-fix.png", ImageFormat.Png);
    var crop = src.Clone(new Rectangle(70, 430, 560, 50), src.PixelFormat);
    crop.Save(@"C:\Users\dufala.DESKTOP-28S4BRA\草原\tools\help-line.png", ImageFormat.Png);
    src.Dispose();
  }
}
