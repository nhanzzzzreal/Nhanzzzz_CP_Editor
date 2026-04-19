#include "testlib.h"
#include <string>
#include <algorithm>

using namespace std;

const string YES = "YES";
const string NO = "NO";

string normalize(string s) {
    for (char &c : s) c = toupper(c);
    if (s == "YES" || s == "TRUE" || s == "1") return YES;
    if (s == "NO" || s == "FALSE" || s == "0") return NO;
    return "INVALID";
}

int main(int argc, char *argv[]) {
    setName("multiple YES/NO, TRUE/FALSE, 0/1");
    registerTestlibCmd(argc, argv);

    int index = 0, yesCount = 0, noCount = 0;
    string pa_normalized;

    while (!ans.seekEof() && !ouf.seekEof()) {
        index++;
        
        string ja_raw = ans.readToken();
        string pa_raw = ouf.readToken();
        
        string ja_normalized = normalize(ja_raw);
        pa_normalized = normalize(pa_raw);

        if (ja_normalized == "INVALID")
            quitf(_fail, "Expected YES/NO, TRUE/FALSE or 0/1 in answer, but %s found [%d%s token]",
                  compress(ja_raw).c_str(), index, englishEnding(index).c_str());

        if (pa_normalized == "INVALID")
            quitf(_pe, "Expected YES/NO, TRUE/FALSE or 0/1, but %s found [%d%s token]",
                  compress(pa_raw).c_str(), index, englishEnding(index).c_str());

        if (pa_normalized == YES)
            yesCount++;
        else
            noCount++;

        // So sánh kết quả đã chuẩn hóa
        if (ja_normalized != pa_normalized)
            quitf(_wa, "Expected %s, found %s [%d%s token]",
                  compress(ja_raw).c_str(), compress(pa_raw).c_str(), index, englishEnding(index).c_str());
    }

    int extraInAnsCount = 0;
    while (!ans.seekEof()) {
        ans.readToken();
        extraInAnsCount++;
    }

    int extraInOufCount = 0;
    while (!ouf.seekEof()) {
        ouf.readToken();
        extraInOufCount++;
    }

    if (extraInAnsCount > 0)
        quitf(_wa, "Answer contains longer sequence [length = %d], but output contains %d elements",
              index + extraInAnsCount, index);

    if (extraInOufCount > 0)
        quitf(_wa, "Output contains longer sequence [length = %d], but answer contains %d elements",
              index + extraInOufCount, index);

    if (index == 0)
        quitf(_ok, "Empty output");
    else if (index == 1)
        quitf(_ok, "Result: %s", pa_normalized.c_str());
    else
        quitf(_ok, "%d token(s): YES/TRUE/1 count: %d, NO/FALSE/0 count: %d", index, yesCount, noCount);

    quitf(_fail, "Impossible case");
}