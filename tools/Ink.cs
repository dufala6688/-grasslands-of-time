using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
class Ink {
  static void Main() {
    using (var bmp = new Bitmap(@"C:\Users\dufala.DESKTOP-28S4BRA\草原\tools\help-crop.png")) {
      var bd = bmp.LockBits(new Rectangle(0,0,bmp.Width,bmp.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      int stride = bd.Stride;
      byte[] pix = new byte[stride * bmp.Height];
      Marshal.Copy(bd.Scan0, pix, 0, pix.Length);
      bmp.UnlockBits(bd);
      // first text line roughly y 8-55
      bool inn=false; int x0=0;
      for (int x=0; x<bmp.Width; x++) {
        int n=0;
        for (int y=4; y<58; y++) {
          int i=y*stride+x*4;
          if (pix[i+2]<120 && pix[i+1]<90 && pix[i]<70) n++;
        }
        bool hit=n>3;
        if (hit && !inn) { inn=true; x0=x; }
        else if (!hit && inn) { Console.WriteLine("{0}-{1} w={2}", x0, x-1, x-x0); inn=false; }
      }
    }
  }
}
