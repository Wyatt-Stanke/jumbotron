const orig = 
`
function test() {
    return 1;
}
`

declare class RetroBowl_ext {
    test(): number;
}

class Test extends RetroBowl_ext {
    _test() {
        return this.test() + 1;
    }
}