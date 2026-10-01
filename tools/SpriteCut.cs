using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;

public static class SpriteCut {
  static bool IsBg(Color c, Color bg, int tol) {
    int dr = c.R - bg.R, dg = c.G - bg.G, db = c.B - bg.B;
    return (dr * dr + dg * dg + db * db) <= tol * tol;
  }

  public static Bitmap KeyAndCopy(Bitmap src, Rectangle rect, Color bg, int tol) {
    Bitmap dst = new Bitmap(rect.Width, rect.Height, PixelFormat.Format32bppArgb);
    for (int y = 0; y < rect.Height; y++) {
      for (int x = 0; x < rect.Width; x++) {
        int sx = rect.X + x, sy = rect.Y + y;
        if (sx < 0 || sy < 0 || sx >= src.Width || sy >= src.Height) continue;
        Color c = src.GetPixel(sx, sy);
        if (IsBg(c, bg, tol)) dst.SetPixel(x, y, Color.Transparent);
        else dst.SetPixel(x, y, Color.FromArgb(255, c));
      }
    }
    return dst;
  }

  public static Rectangle ContentBox(Bitmap bmp) {
    int minX = bmp.Width, minY = bmp.Height, maxX = -1, maxY = -1;
    for (int y = 0; y < bmp.Height; y++) {
      for (int x = 0; x < bmp.Width; x++) {
        if (bmp.GetPixel(x, y).A > 20) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX) return new Rectangle(0, 0, 1, 1);
    return new Rectangle(minX, minY, maxX - minX + 1, maxY - minY + 1);
  }

  public static Bitmap FitBottom(Bitmap src, int W, int H, int pad) {
    Rectangle box = ContentBox(src);
    Bitmap crop = src.Clone(box, PixelFormat.Format32bppArgb);
    Bitmap canvas = new Bitmap(W, H, PixelFormat.Format32bppArgb);
    using (Graphics g = Graphics.FromImage(canvas)) {
      g.Clear(Color.Transparent);
      g.InterpolationMode = InterpolationMode.HighQualityBicubic;
      float scale = Math.Min((W - pad * 2f) / crop.Width, (H - pad * 2f) / crop.Height);
      int dw = (int)Math.Round(crop.Width * scale);
      int dh = (int)Math.Round(crop.Height * scale);
      int dx = (W - dw) / 2;
      int dy = H - pad - dh;
      g.DrawImage(crop, dx, dy, dw, dh);
    }
    crop.Dispose();
    return canvas;
  }

  public static void CutSheet(string path, string outDir, string prefix, string[] names, int tol) {
    Directory.CreateDirectory(outDir);
    using (Bitmap src = new Bitmap(path)) {
      Color bg = src.GetPixel(2, 2);
      int cols = 3;
      int cellW = src.Width / cols;
      int cellH = cellW;
      for (int i = 0; i < 9; i++) {
        int col = i % 3, row = i / 3;
        int x = col * cellW;
        int y = row * cellH;
        int spriteH = (int)(cellH * 0.78);
        Rectangle rect = new Rectangle(x, y, cellW, spriteH);
        using (Bitmap keyed = KeyAndCopy(src, rect, bg, tol))
        using (Bitmap fitted = FitBottom(keyed, 400, 400, 12)) {
          string dest = Path.Combine(outDir, prefix + "_" + names[i] + ".png");
          fitted.Save(dest, ImageFormat.Png);
        }
      }
    }
  }

  public static void CropOpaque(string path, string dest, int bgTol, bool blackBg) {
    using (Bitmap src = new Bitmap(path)) {
      int minX = src.Width, minY = src.Height, maxX = -1, maxY = -1;
      for (int y = 0; y < src.Height; y++) {
        for (int x = 0; x < src.Width; x++) {
          Color c = src.GetPixel(x, y);
          bool empty = c.A < 10 || (blackBg && c.R < bgTol && c.G < bgTol && c.B < bgTol);
          if (!empty) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < minX) { src.Save(dest); return; }
      Rectangle box = new Rectangle(minX, minY, maxX - minX + 1, maxY - minY + 1);
      using (Bitmap crop = src.Clone(box, PixelFormat.Format32bppArgb)) {
        crop.Save(dest, ImageFormat.Png);
      }
    }
  }

  public static int Main(string[] args) {
    string art = args[0];
    string sp = args[1];
    string ui = args[2];
    string[] cow = { "idle", "walk1", "walk2", "eat1", "eat2", "eat3", "drag", "jump", "sleep" };
    string[] sheep = { "idle", "walk1", "walk2", "eat1", "eat2", "eat3", "sleep", "drag", "jump" };
    string[] dog = { "idle", "walk1", "walk2", "walk3", "walk4", "herd", "land", "sit1", "sit2" };
    CutSheet(Path.Combine(art, "牛的动作板.jpg"), sp, "cow", cow, 48);
    CutSheet(Path.Combine(art, "羊的动作板.jpg"), sp, "sheep", sheep, 48);
    CutSheet(Path.Combine(art, "狗的动作板.jpg"), sp, "dog", dog, 48);
    CropOpaque(Path.Combine(ui, "panel-empty.png"), Path.Combine(ui, "panel.png"), 28, true);
    CropOpaque(Path.Combine(ui, "title.png"), Path.Combine(ui, "title.png"), 18, true);
    return 0;
  }
}
