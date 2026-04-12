fi = open("caitui.inp", 'r')
fo = open("caitui.out", 'w')

n, s = [int(i) for i in fi.readline().split()]
w, v = [], []
for i in range(n):
    a, b = [int(i) for i in fi.readline().split()]
    w.append(a)
    v.append(b)

ans = 0
def solve(i, value, weight):
    global ans
    if i == n:
        if weight <= s:
            ans = max(ans, value)
    else:
        solve(i+1, value, weight)
        if weight + w[i] <= s:
            solve(i+1, value + v[i], weight + w[i])

solve(0, 0, 0)
print(ans, file = fo)
fi.close()
fo.close()