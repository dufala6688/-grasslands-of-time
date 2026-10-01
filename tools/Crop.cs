using System;
using System.Drawing;
using System.Drawing.Imaging;
public class Crop {
  public static void Run(string path, string dest, int bgTol) {
    using (Bitmap src = new Bitmap(path)) {
      int minX = src.Width, minY = src.Height, maxX = -1, maxY = -1;
      for (int y = 0; y < src.Height; y++) {
        for (int x = 0; x < src.Width; x++) {
          Color c = src.GetPixel(x, y);
          bool empty = c.A < 10 || (c.R < bgTol && c.G < bgTol && c.B < bgTol);
          if (!empty) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }
      Rectangle box = new Rectangle(minX, minY, maxX - minX + 1, maxY - minY + 1);
      using (Bitmap crop = src.Clone(box, PixelFormat.Format32bppArgb)) {
        crop.Save(dest, ImageFormat.Png);
      }
    }
  }
  static int Main(string[] a) { Run(a[0], a[1], int.Parse(a[2])); return 0; }
}
