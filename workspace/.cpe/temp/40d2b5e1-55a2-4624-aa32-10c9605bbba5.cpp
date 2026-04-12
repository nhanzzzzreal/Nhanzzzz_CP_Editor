import sys
with open("tdong.inp",'r') as sys.stdin:
    n = int(input())
    arr1 = []
    for i in range(n):
        arr1.append(int(input()))
    k = int(input())
    arr2 = []
    for i in range(k):
        arr2.append(int(input()))
    arr2.sort()
#
def same1(arr1,arr2):
    arr1.sort()
    dif = arr1[0] - arr2[0]
    for i in range(1,len(arr2)):
        if arr1[i] - arr2[i] != dif:
            return False
    return True
out = []
for i in range(n-k+1):
    arr = [arr1[j] for j in range(i,i+k)]
    if same1(arr,arr2):
        out.append(i+1)
#
with open("tdong.out",'w') as sys.stdout:
    print(len(out))
    for i in out:
        print(i)
