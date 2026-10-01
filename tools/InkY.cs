using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
class InkY {
  static void Main() {
    using (var bmp = new Bitmap(@"C:\Users\dufala.DESKTOP-28S4BRA\草原\tools\help-crop.png")) {
      var bd = bmp.LockBits(new Rectangle(0,0,bmp.Width,bmp.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      int stride = bd.Stride;
      byte[] pix = new byte[stride * bmp.Height];
      Marshal.Copy(bd.Scan0, pix, 0, pix.Length);
      bmp.UnlockBits(bd);
      int y0=999, y1=0;
      for (int y=0; y<70; y++) {
        for (int x=436; x<=460; x++) {
          int i=y*stride+x*4;
          if (pix[i+2]<140 && pix[i+1]<110 && pix[i]<90) { if (y<y0) y0=y; if (y>y1) y1=y; }
        }
      }
      // sample cream nearby
      int si = 20*stride + 470*4;
      Console.WriteLine("glyph y {0}-{1} cream {2},{3},{4}", y0, y1, pix[si+2], pix[si+1], pix[si]);
      int si2 = 30*stride + 400*4;
      Console.WriteLine("ink sample {0},{1},{2}", pix[(y0+4)*stride+440*4+2], pix[(y0+4)*stride+440*4+1], pix[(y0+4)*stride+440*4]);
    }
  }
}
