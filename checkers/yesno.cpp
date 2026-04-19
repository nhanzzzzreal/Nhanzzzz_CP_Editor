#include "testlib.h"
#include <string>
#include <algorithm>

using namespace std;

const string YES = "YES";
const string NO = "NO";

string toStandard(string s) {
    s = upperCase(s);
    if (s == "YES" || s == "TRUE" || s == "1") return YES;
    if (s == "NO" || s == "FALSE" || s == "0") return NO;
    return "INVALID";
}

int main(int argc, char *argv[]) {
    setName("Checker for YES/NO, TRUE/FALSE, 0/1 (case insensitive)");
    registerTestlibCmd(argc, argv);

    string raw_ja = ans.readWord();
    string raw_pa = ouf.readWord();

    string ja = toStandard(raw_ja);
    string pa = toStandard(raw_pa);

    if (ja == "INVALID")
        quitf(_fail, "Answer contains invalid token: %s", compress(raw_ja).c_str());

    if (pa == "INVALID")
        quitf(_pe, "Expected boolean-like token (YES/NO, TRUE/FALSE, 0/1), but found: %s", compress(raw_pa).c_str());

    if (ja != pa)
        quitf(_wa, "Expected %s (standardized), found %s", ja.c_str(), pa.c_str());

    quitf(_ok, "Answer is %s", ja.c_str());
}