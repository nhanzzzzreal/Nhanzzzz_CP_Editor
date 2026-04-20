#include "testlib.h"

using namespace std;

int main(int argc, char* argv[]) {
    setName("compare exact characters (Strict byte-by-byte)");
    registerTestlibCmd(argc, argv);

    int pos = 0;
    while (!ans.eof() && !ouf.eof()) {
        char c_ans = ans.readChar();
        char c_ouf = ouf.readChar();
        
        if (c_ans != c_ouf) {
            quitf(_wa, "Sai khac tai vi tri byte %d (Expected: ASCII %d, Actual: ASCII %d).", 
                  pos, (int)c_ans, (int)c_ouf);
        }
        pos++;
    }

    if (!ans.eof()) {
        quitf(_wa, "Output ngan hon Expected Answer (thieu ky tu).");
    }

    if (!ouf.eof()) {
        quitf(_wa, "Output dai hon Expected Answer (in du ky tu hoac dau xuong dong o cuoi).");
    }

    quitf(_ok, "Khop chinh xac tuyet doi (%d bytes).", pos);
}