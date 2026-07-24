import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PDFDocument } from "pdf-lib";

interface SignedItemInput {
  id: string;
  type: "signature" | "stamp";
  dataUrl: string;
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  heightRatio: number;
  pageNumber: number;
}

export async function POST(req: NextRequest) {
  try {
    const { token, items } = (await req.json()) as { token: string; items: SignedItemInput[] };
    if (!token || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    const MAX_ITEMS = 20;
    const MAX_DATA_URL_LENGTH = 5 * 1024 * 1024;
    if (items.length > MAX_ITEMS) {
      return NextResponse.json({ error: "서명/도장 항목이 너무 많습니다." }, { status: 400 });
    }
    if (
      items.some(
        (item) => typeof item.dataUrl !== "string" || item.dataUrl.length > MAX_DATA_URL_LENGTH,
      )
    ) {
      return NextResponse.json({ error: "이미지 크기가 너무 큽니다." }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: contract } = await supabase
      .from("contracts")
      .select("id, status, token_expires_at, pdf_url")
      .eq("sign_token", token)
      .single();

    if (!contract) {
      return NextResponse.json({ error: "유효하지 않은 서명 링크입니다." }, { status: 404 });
    }
    if (contract.status === "signed") {
      return NextResponse.json({ error: "이미 서명 완료된 계약서입니다." }, { status: 409 });
    }
    if (new Date(contract.token_expires_at) < new Date()) {
      return NextResponse.json({ error: "만료된 서명 링크입니다." }, { status: 410 });
    }

    const uploaded = await Promise.all(
      items.map(async (item) => {
        const fileName = `signatures/${contract.id}/${item.id}.png`;
        const base64 = item.dataUrl.split(",")[1] ?? "";
        const buffer = Buffer.from(base64, "base64");
        const { error: uploadError } = await supabase.storage
          .from("contracts")
          .upload(fileName, buffer, { contentType: "image/png", upsert: true });
        if (uploadError) throw new Error(uploadError.message);
        const {
          data: { publicUrl },
        } = supabase.storage.from("contracts").getPublicUrl(fileName);
        return { item, buffer, publicUrl };
      }),
    );

    const signedItems = uploaded.map(({ item, publicUrl }) => ({ ...item, dataUrl: publicUrl }));

    // 서명 완료 시 원본 PDF에 서명 이미지를 실제로 합성해 최종본을 생성한다 (best-effort:
    // 합성이 실패해도 서명 제출 자체는 정상 처리하고 signed_pdf_url만 비워둔다).
    let signedPdfUrl: string | null = null;
    const pdfPath = contract.pdf_url ? contract.pdf_url.split("/contracts/")[1] : null;
    if (pdfPath) {
      try {
        const { data: pdfBlob, error: dlErr } = await supabase.storage
          .from("contracts")
          .download(pdfPath);
        if (dlErr || !pdfBlob) throw new Error(dlErr?.message ?? "원본 PDF 다운로드 실패");

        const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const page = pdfDoc.getPages()[0];
        const { width: pageWidthPt, height: pageHeightPt } = page.getSize();

        for (const { item, buffer } of uploaded) {
          const png = await pdfDoc.embedPng(buffer);
          const wPt = item.widthRatio * pageWidthPt;
          const hPt = item.heightRatio * pageHeightPt;
          const xPt = item.xRatio * pageWidthPt;
          const yPt = pageHeightPt - item.yRatio * pageHeightPt - hPt;
          page.drawImage(png, { x: xPt, y: yPt, width: wPt, height: hPt });
        }

        const flattenedBytes = await pdfDoc.save();
        const signedPath = `signed/${contract.id}.pdf`;
        const { error: upErr } = await supabase.storage
          .from("contracts")
          .upload(signedPath, flattenedBytes, { contentType: "application/pdf", upsert: true });
        if (upErr) throw new Error(upErr.message);
        signedPdfUrl = supabase.storage.from("contracts").getPublicUrl(signedPath).data.publicUrl;
      } catch (flattenErr) {
        console.error("서명 PDF 합성 실패:", flattenErr);
      }
    } else {
      console.error("pdf_url에서 storage 경로를 파싱하지 못했습니다:", contract.pdf_url);
    }

    const { error: updateError } = await supabase
      .from("contracts")
      .update({
        status: "signed",
        signed_at: new Date().toISOString(),
        signature_zones: signedItems,
        signed_pdf_url: signedPdfUrl,
      })
      .eq("id", contract.id);

    if (updateError) {
      return NextResponse.json(
        { error: "서명 저장 실패: " + updateError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
