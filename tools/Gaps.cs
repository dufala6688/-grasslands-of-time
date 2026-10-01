using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Collections.Generic;
class Gaps {
  static void Main(string[] args) {
    using (var bmp = new Bitmap(args[0])) {
      var bd = bmp.LockBits(new Rectangle(0,0,bmp.Width,bmp.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      int stride = bd.Stride;
      byte[] pix = new byte[stride * bmp.Height];
      Marshal.Copy(bd.Scan0, pix, 0, pix.Length);
      bmp.UnlockBits(bd);
      int steps = 28;
      for (int s=0; s<=steps; s++) {
        int y = (int)(bmp.Height * (0.28 + 0.68 * s / steps));
        var runs = new List<int>();
        int run=-1;
        for (int x=0; x<bmp.Width; x++) {
          int i=y*stride+x*4;
          bool red = pix[i+2]>200 && pix[i+1]<90 && pix[i]<90;
          if (red && run<0) run=x;
          else if (!red && run>=0) { runs.Add(run); runs.Add(x-1); run=-1; }
        }
        if (run>=0) { runs.Add(run); runs.Add(bmp.Width-1); }
        Console.Write("y={0:F3}", (double)y/bmp.Height);
        for (int k=0;k<runs.Count;k+=2) Console.Write(" [{0:F3}-{1:F3}]", (double)runs[k]/bmp.Width, (double)runs[k+1]/bmp.Width);
        Console.WriteLine();
      }
    }
  }
}
