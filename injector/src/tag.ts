export class Tag {
    inner: number | string;

    constructor(inner: number | string) {
        this.inner = inner;
    }
}

export function tag(inner: number | string): Tag {
    return new Tag(inner);
}