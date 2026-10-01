using System;
using System.IO;
using System.Text;

class PsdLayers {
  static uint U32(BinaryReader r) {
    byte[] b = r.ReadBytes(4);
    return (uint)((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]);
  }
  static int I32(BinaryReader r) { return unchecked((int)U32(r)); }
  static ushort U16(BinaryReader r) {
    byte[] b = r.ReadBytes(2);
    return (ushort)((b[0] << 8) | b[1]);
  }
  static void Main(string[] args) {
    using (var fs = File.OpenRead(args[0]))
    using (var r = new BinaryReader(fs)) {
      fs.Position = 26;
      uint cm = U32(r);
      fs.Position += cm;
      uint ir = U32(r);
      Console.WriteLine("cm={0} ir={1} pos={2}", cm, ir, fs.Position);
      fs.Position += ir;
      uint lm = U32(r);
      Console.WriteLine("lm={0} pos={1}", lm, fs.Position);
      long lmEnd = fs.Position + lm;
      uint li = U32(r);
      Console.WriteLine("li={0}", li);
      short count = unchecked((short)U16(r));
      if (count < 0) count = (short)-count;
      Console.WriteLine("layers={0}", count);
      for (int i = 0; i < count; i++) {
        int top = I32(r), left = I32(r), bottom = I32(r), right = I32(r);
        int nch = U16(r);
        for (int c = 0; c < nch; c++) { U16(r); U32(r); }
        r.ReadBytes(4); // 8BIM
        r.ReadBytes(4); // blend
        r.ReadByte(); r.ReadByte(); r.ReadByte(); r.ReadByte();
        uint extra = U32(r);
        long extraStart = fs.Position;
        uint maskLen = U32(r);
        if (maskLen > 0) fs.Position += maskLen;
        uint blendLen = U32(r);
        if (blendLen > 0) fs.Position += blendLen;
        int nameLen = r.ReadByte();
        byte[] nb = r.ReadBytes(nameLen);
        string name = Encoding.GetEncoding(28591).GetString(nb);
        int nameField = 1 + nameLen;
        int pad = (4 - (nameField % 4)) % 4;
        fs.Position = extraStart + 4 + maskLen + 4 + blendLen + nameField + pad;
        string uni = "";
        while (fs.Position + 12 <= extraStart + extra) {
          r.ReadBytes(4);
          string akey = Encoding.ASCII.GetString(r.ReadBytes(4));
          uint alen = U32(r);
          long ab = fs.Position;
          if (akey == "luni" && alen >= 4) {
            uint ulen = U32(r);
            var sb = new StringBuilder();
            for (int k = 0; k < ulen; k++) {
              byte[] ch = r.ReadBytes(2);
              sb.Append((char)((ch[0] << 8) | ch[1]));
            }
            uni = sb.ToString();
          }
          long next = ab + alen;
          if ((alen & 1) == 1) next++;
          fs.Position = next;
        }
        fs.Position = extraStart + extra;
        string label = uni.Length > 0 ? uni : name;
        Console.WriteLine("{0,3} {1,6},{2,6} {3,6}x{4,6}  {5}", i, left, top, right - left, bottom - top, label);
      }
    }
  }
}
