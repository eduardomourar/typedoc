import { deepStrictEqual as equal, doesNotThrow } from "assert";
import {
    binaryFindPartition,
    insertOrderSorted,
    insertPrioritySorted,
    maxElementByScore,
    removeIfPresent,
} from "#utils";

describe("Array utils", () => {
    describe("insertPrioritySorted", () => {
        const item1 = { priority: 1 };
        const item2 = { priority: 2 };
        const item3 = { priority: 3 };
        const item4 = { priority: 4 };

        it("works with an empty array", () => {
            equal(insertPrioritySorted([], item1), [item1]);
        });

        it("inserts at the start", () => {
            equal(insertPrioritySorted([item1], item2), [item2, item1]);
        });

        it("inserts in the middle", () => {
            equal(insertPrioritySorted([item3, item1], item2), [
                item3,
                item2,
                item1,
            ]);
        });

        it("inserts at the end", () => {
            equal(insertPrioritySorted([item4, item3], item2), [
                item4,
                item3,
                item2,
            ]);
        });

        it("inserts new items last", () => {
            const item0 = { priority: 1, first: false };
            equal(insertPrioritySorted([item1], item0), [item1, item0]);
        });
    });

    describe("insertOrderSorted", () => {
        const item1 = { order: 1 };
        const item2 = { order: 2 };
        const item3 = { order: 3 };
        const item4 = { order: 4 };

        it("works with an empty array", () => {
            equal(insertOrderSorted([], item1), [item1]);
        });

        it("inserts at the start", () => {
            equal(insertOrderSorted([item2], item1), [item1, item2]);
        });

        it("inserts in the middle", () => {
            equal(insertOrderSorted([item1, item3], item2), [
                item1,
                item2,
                item3,
            ]);
        });

        it("inserts at the end", () => {
            equal(insertOrderSorted([item2, item3], item4), [
                item2,
                item3,
                item4,
            ]);
        });

        it("inserts new items last", () => {
            const item0 = { order: 1, last: true };
            equal(insertOrderSorted([item1], item0), [item1, item0]);
        });
    });

    describe("binaryFindPartition", () => {
        const always = () => true;

        it("works with empty array", () => {
            equal(binaryFindPartition([], always), -1);
        });

        it("works with one item", () => {
            equal(binaryFindPartition([1], always), 0);
        });

        it("works with more items", () => {
            equal(
                binaryFindPartition([1, 2, 3], (n) => n > 2),
                2,
            );
            equal(
                binaryFindPartition([1, 2, 3, 4, 5, 6, 7], (n) => n > 5),
                5,
            );
        });

        it("works with no partition", () => {
            equal(
                binaryFindPartition([1, 2, 3], () => false),
                -1,
            );
        });

        it("works with big arrays", () => {
            const index = 50168;
            const arr = Array.from<number>({ length: 1e5 })
                .fill(0, 0, index)
                .fill(1, index);

            equal(
                binaryFindPartition(arr, (v) => v === 1),
                index,
            );
        });
    });

    describe("removeIfPresent", () => {
        it("Supports a missing array", () => {
            doesNotThrow(() => removeIfPresent(undefined, true));
        });

        it("Does not remove items if the item is not in the array", () => {
            const arr = [1, 2, 3];
            removeIfPresent(arr, 4);
            equal(arr, [1, 2, 3]);
        });

        it("Removes a single item if it is present in the array", () => {
            const arr = [1, 2, 1];
            removeIfPresent(arr, 1);
            equal(arr, [2, 1]);
        });
    });

    describe("maxElementByScore", () => {
        it("Gets the max element", () => {
            const arr = [1, 2, 3];
            const item = maxElementByScore(arr, (x) => x);
            equal(item, 3);
        });

        it("Prioritizes elements earlier in the array", () => {
            const arr = [1, 2, 3];
            const item = maxElementByScore(arr, () => 1);
            equal(item, 1);
        });

        it("Returns undefined for an empty array", () => {
            const arr: unknown[] = [];
            const item = maxElementByScore(arr, () => 1);
            equal(item, undefined);
        });
    });
});
