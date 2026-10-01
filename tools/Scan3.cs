using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
class Scan3 {
  static bool Bar(byte[] pix, int stride, int x, int y) {
    int i = y*stride + x*4;
    int b=pix[i], g=pix[i+1], r=pix[i+2];
    return r>205 && r<240 && g>188 && g<222 && b>168 && b<205 && (r-b)>25 && (r-g)>10;
  }
  static void Main() {
    using (var bmp = new Bitmap(@"C:\Users\dufala.DESKTOP-28S4BRA\草原\assets\ui\panel.png")) {
      var bd = bmp.LockBits(new Rectangle(0,0,bmp.Width,bmp.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      int stride = bd.Stride;
      byte[] pix = new byte[stride * bmp.Height];
      Marshal.Copy(bd.Scan0, pix, 0, pix.Length);
      bmp.UnlockBits(bd);
      foreach (int y in new int[]{283, 636, 985}) {
        int bestL=0,bestR=0,best=0, runL=-1;
        for (int x=0; x<bmp.Width; x++) {
          if (Bar(pix,stride,x,y)) { if (runL<0) runL=x; }
          else if (runL>=0) {
            int len=x-runL;
            if (len>best) { best=len; bestL=runL; bestR=x-1; }
            runL=-1;
          }
        }
        int ink0=-1, ink1=-1;
        for (int x=bestR; x<bmp.Width; x++) {
          int i=y*stride+x*4;
          if (pix[i+2]<90 && pix[i+1]<80 && pix[i]<70) { if (ink0<0) ink0=x; ink1=x; }
        }
        Console.WriteLine("y={0} bar {1}-{2} w={3} ink {4}-{5}", y, bestL, bestR, best, ink0, ink1);
      }
    }
  }
}
