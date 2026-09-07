import { describe, expectTypeOf, it } from "vitest";

import type { DepartmentRef, UserRef } from "../xml/decode";
import type {
  Candidate,
  CandidateCreateInput,
  CandidateSearchQuery,
  CandidateUpdateInput,
} from "./candidate";
import type { JobResource, JobSearchQuery } from "./job";
import type { ProcessCreateInput } from "./process";

// The Read shapes a Job accessor resolves to, at three levels of expansion. `declare` keeps these
// purely type-level: nothing is constructed or called at runtime. The `_` prefix says so — they
// exist to be the subject of `typeof`, never to be read.
declare const _job: JobResource;
declare const _looseQuery: JobSearchQuery;
// The same accessor with a tenant Image / Link field declared (ADR-0023 + ADR-0064): no standard
// field is Image- or Link-typed, so the custom catalog is the only way these types reach a record.
declare const _album: JobResource<{ U_photo: "Image"; U_link: "Link" }>;
type ExpandedClient = Awaited<
  ReturnType<
    typeof _job.search<{ readonly P_Client: readonly ["P_Id", "P_Name"] }>
  >
>;
type PlainJobPage = Awaited<ReturnType<typeof _job.search>>;
type LooseQueryPage = Awaited<
  ReturnType<typeof _job.search<typeof _looseQuery.expand & object>>
>;

// Type-level tests for the catalog-derived static types (ADR-0019). These are no-ops at
// runtime; `tsc --noEmit` (the typecheck gate) checks the assertions.
describe("SD-3 static resource types (ADR-0019)", () => {
  it("Read maps each Data Type to its value — every field optional + nullable", () => {
    expectTypeOf<Candidate>()
      .toHaveProperty("P_Id")
      .toEqualTypeOf<number | null | undefined>(); // System[Id] -> number
    expectTypeOf<Candidate>()
      .toHaveProperty("P_Name")
      .toEqualTypeOf<string | null | undefined>(); // SinglelineText -> string
    expectTypeOf<Candidate>()
      .toHaveProperty("P_Phase")
      .toEqualTypeOf<string[] | null | undefined>(); // Option -> string[]
    expectTypeOf<Candidate>()
      .toHaveProperty("P_Owner")
      .toEqualTypeOf<UserRef | null | undefined>(); // User -> UserRef
    expectTypeOf<Candidate>()
      .toHaveProperty("P_UpdateDate")
      .toEqualTypeOf<string | null | undefined>(); // System[DateTime] -> string
  });

  it("create requires P_Owner (W2) and excludes System[Id] / System[DateTime]", () => {
    // required-on-create: the property is non-optional (`number`, not `number | undefined`)
    expectTypeOf<CandidateCreateInput>()
      .toHaveProperty("P_Owner")
      .toEqualTypeOf<number>();
    // a writable, non-required field is optional + nullable
    expectTypeOf<CandidateCreateInput>()
      .toHaveProperty("P_Name")
      .toEqualTypeOf<string | null | undefined>();
    // library-supplied id and Write-restricted timestamps are not create fields
    expectTypeOf<CandidateCreateInput>().not.toHaveProperty("P_Id");
    expectTypeOf<CandidateCreateInput>().not.toHaveProperty(
      "P_RegistrationDate",
    );
    expectTypeOf<CandidateCreateInput>().not.toHaveProperty("P_UpdateDate");
  });

  it("create required set follows the reference per resource (Process = relations, LV-5)", () => {
    // Process requires P_Owner + the five relation fields (docs/reference resources/process.md)
    expectTypeOf<ProcessCreateInput>()
      .toHaveProperty("P_Owner")
      .toEqualTypeOf<number>();
    expectTypeOf<ProcessCreateInput>()
      .toHaveProperty("P_Job")
      .toEqualTypeOf<number>();
    expectTypeOf<ProcessCreateInput>()
      .toHaveProperty("P_Candidate")
      .toEqualTypeOf<number>();
    // a non-required field stays optional
    expectTypeOf<ProcessCreateInput>()
      .toHaveProperty("P_PhaseMemo")
      .toEqualTypeOf<string | null | undefined>();
  });

  it("update makes every writable field optional; same exclusions", () => {
    expectTypeOf<CandidateUpdateInput>()
      .toHaveProperty("P_Owner")
      .toEqualTypeOf<number | null | undefined>(); // optional on update
    expectTypeOf<CandidateUpdateInput>().not.toHaveProperty("P_Id");
    expectTypeOf<CandidateUpdateInput>().not.toHaveProperty(
      "P_RegistrationDate",
    );
  });
});

// PORTERS はこの項目を「Read の field でのみ指定可・Condition/Order 不可・Write 不可」と定める。
// カタログに `null`（＝ Data Type が無い）と書くだけで、その 3 つが導出型に現れることを固定する。
// 追加のガード実装は無いので、ここが壊れたら制約そのものが消えている（ADR-0056）。
describe("型を持たない項目（P_Deleted）の制約 — ADR-0056", () => {
  it('Read には出る。値は生の文字列（"0" / "1"）', () => {
    expectTypeOf<Candidate>()
      .toHaveProperty("P_Deleted")
      .toEqualTypeOf<string | null | undefined>();
  });

  it("condition には出せない（ConditionFor が never に落ちる）", () => {
    expectTypeOf<
      NonNullable<CandidateSearchQuery["condition"]>
    >().toHaveProperty("P_Deleted");
    expectTypeOf<
      NonNullable<CandidateSearchQuery["condition"]>["P_Deleted"]
    >().toEqualTypeOf<undefined>();
  });

  it("order には出せない（OrderableKeys から外れる）", () => {
    expectTypeOf<
      NonNullable<CandidateSearchQuery["order"]>[number]
    >().not.toHaveProperty("P_Deleted");
  });

  it("create / update の入力に出ない（WritableKeys から外れる）", () => {
    expectTypeOf<CandidateCreateInput>().not.toHaveProperty("P_Deleted");
    expectTypeOf<CandidateUpdateInput>().not.toHaveProperty("P_Deleted");
  });
});

// `field` は接頭辞なしの型付き alias で受ける（ADR-0059）。綴り間違い・接頭辞付き・展開文字列が
// **コンパイル時に**止まることが決定の中身なので、型の側で固定する。実行時テストでは捕まえられない。
describe("Read の field は接頭辞なしの型付き alias — ADR-0059", () => {
  type Field = NonNullable<CandidateSearchQuery["field"]>[number];

  it("カタログ済みの標準項目を素の alias で受ける", () => {
    expectTypeOf<"P_Name">().toExtend<Field>();
    expectTypeOf<"P_Deleted">().toExtend<Field>(); // 型を持たない項目も field には出せる
  });

  it("未宣言のカスタム項目は U_/A_ の命名規則で受ける", () => {
    expectTypeOf<"U_memo">().toExtend<Field>();
    expectTypeOf<"A_flag">().toExtend<Field>();
  });

  it("綴り間違い・接頭辞付き・展開文字列は型として書けない", () => {
    expectTypeOf<"P_Nmae">().not.toExtend<Field>();
    expectTypeOf<"Person.P_Name">().not.toExtend<Field>();
    expectTypeOf<"Candidate.P_Name">().not.toExtend<Field>(); // 接頭辞の罠そのものが消える
    expectTypeOf<"Job.P_Client(Client.P_Id)">().not.toExtend<Field>(); // ADR-0058 と噛み合う
  });
});

// 参照型の展開（ADR-0058）。**税を払う人が違う**ことが案D を選んだ理由なので、
// 「expand を書いたときだけ型が変わる」を型で固定する。ここが崩れると案C になる。
describe("expand — 参照先の項目を読む（ADR-0058）", () => {
  type JobExpand = NonNullable<JobSearchQuery["expand"]>;

  it("参照先が登録されている項目だけ expand に書ける", () => {
    expectTypeOf<JobExpand>().toHaveProperty("P_Client");
    // Recruiter の実装（ADR-0060 D1）でカタログが揃い、P_Recruiter も展開できるようになった。
    expectTypeOf<JobExpand>().toHaveProperty("P_Recruiter");
    // System[Reference] でない項目は書けない＝「参照先カタログがあるものだけ」が型に出ている。
    expectTypeOf<JobExpand>().not.toHaveProperty("P_Position");
  });

  it("参照先の素の alias だけを受ける（接頭辞も未知の alias も書けない）", () => {
    expectTypeOf<readonly ["P_Id", "P_Name"]>().toExtend<
      JobExpand["P_Client"]
    >();
    expectTypeOf<readonly ["Client.P_Id"]>().not.toExtend<
      JobExpand["P_Client"]
    >();
    expectTypeOf<readonly ["P_Nope"]>().not.toExtend<JobExpand["P_Client"]>();
  });

  it("expand を書いたときだけ、その項目が参照レコードになる", () => {
    expectTypeOf<ExpandedClient["items"][number]["P_Client"]>().toEqualTypeOf<
      { P_Id?: number | null; P_Name?: string | null } | null | undefined
    >();
    // 展開しなかった参照は ID のまま＝展開を使わない利用者に narrowing の税がかからない
    expectTypeOf<
      ExpandedClient["items"][number]["P_Recruiter"]
    >().toEqualTypeOf<number | null | undefined>();
  });

  it("expand を書かなければ従来どおり ID", () => {
    expectTypeOf<PlainJobPage["items"][number]["P_Client"]>().toEqualTypeOf<
      number | null | undefined
    >();
  });

  it("クエリを JobSearchQuery 型で宣言しただけではレコード型は変わらない", () => {
    // `ExpandedValue` の条件型を非分配にしてある理由。loose な宣言は「展開した」約束ではない。
    expectTypeOf<LooseQueryPage["items"][number]["P_Client"]>().toEqualTypeOf<
      number | null | undefined
    >();
  });
});

// Image のサブタグ選択（ADR-0064 論点2）。expand と同じく**選んだ人だけ型が変わる**ことが
// 案2a を選んだ理由なので、型で固定する。ここが崩れると「一覧が 2MB × 件数」に戻る。
describe("image — Image 項目のサブタグを選ぶ（ADR-0064）", () => {
  type Selected = Awaited<
    ReturnType<
      typeof _album.search<
        Record<never, never>,
        { readonly U_photo: readonly ["FileName", "Content"] }
      >
    >
  >;
  type Plain = Awaited<ReturnType<typeof _album.search>>;

  it("選んだサブタグだけが値に出る（選んでいないものは書けない）", () => {
    expectTypeOf<Selected["items"][number]["U_photo"]>().toEqualTypeOf<
      { FileName: string | null; Content: string | null } | null | undefined
    >();
  });

  it("image を書かなければ既定＝サブタグはどれも optional（PORTERS は FileName のみ返す）", () => {
    expectTypeOf<Plain["items"][number]["U_photo"]>().toEqualTypeOf<
      | {
          FileName?: string | null;
          ContentType?: string | null;
          Content?: string | null;
        }
      | null
      | undefined
    >();
  });

  it("Image 型でない項目は image に書けない", () => {
    type AlbumImage = NonNullable<Parameters<typeof _album.search>[0]>["image"];
    expectTypeOf<NonNullable<AlbumImage>>().toHaveProperty("U_photo");
    expectTypeOf<NonNullable<AlbumImage>>().not.toHaveProperty("P_Name");
    expectTypeOf<NonNullable<AlbumImage>>().not.toHaveProperty("U_link");
  });

  it("Image / Link は condition にも order にも書けない（ADR-0064 論点6）", () => {
    // `ConditionOf` は「使えない」を never で**書き下す**表なので、行を書き換えれば通ってしまう。
    // 決定そのものをここで固定する。Image は reference が不可と明記、Link は記載が無いので狭い側。
    type AlbumQuery = NonNullable<Parameters<typeof _album.search>[0]>;
    type AlbumCondition = NonNullable<AlbumQuery["condition"]>;
    expectTypeOf<AlbumCondition["U_photo"]>().toEqualTypeOf<undefined>();
    expectTypeOf<AlbumCondition["U_link"]>().toEqualTypeOf<undefined>();
    // order は列挙型なので、載っていないこと自体が「並べ替えられない」
    type AlbumOrder = NonNullable<AlbumQuery["order"]>[number];
    expectTypeOf<AlbumOrder>().not.toHaveProperty("U_photo");
    expectTypeOf<AlbumOrder>().not.toHaveProperty("U_link");
  });

  it("Link は 3 形の union で読める＝テナント設定と食い違いようがない", () => {
    expectTypeOf<Plain["items"][number]["U_link"]>().toEqualTypeOf<
      number | UserRef | DepartmentRef | null | undefined
    >();
  });
});
