-- 설치완료 처리 시 배정된 장비(installations.items)를 재고(inventory_items)에서
-- 자동으로 차감하고 inventory_logs에 이력을 남기는 RPC.
-- 품목명이 inventory_items.name과 정확히 일치하는 경우에만 차감되며,
-- 일치하지 않는 품목명은 unmatched_name으로 반환되어 클라이언트에서 경고 표시에 사용된다.

CREATE OR REPLACE FUNCTION deduct_inventory_on_install(
  p_items jsonb,
  p_install_id uuid,
  p_note text DEFAULT NULL
)
RETURNS TABLE(unmatched_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  it jsonb;
  matched_id uuid;
  qty int;
BEGIN
  FOR it IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    qty := COALESCE((it->>'quantity')::int, 0);
    IF qty <= 0 THEN
      CONTINUE;
    END IF;

    SELECT id INTO matched_id FROM inventory_items WHERE name = (it->>'name') LIMIT 1;

    IF matched_id IS NULL THEN
      unmatched_name := it->>'name';
      RETURN NEXT;
    ELSE
      UPDATE inventory_items
      SET quantity = quantity - qty, last_checked = CURRENT_DATE
      WHERE id = matched_id;

      INSERT INTO inventory_logs (item_id, item_name, change, reason)
      VALUES (
        matched_id,
        it->>'name',
        -qty,
        COALESCE(p_note, '설치완료 자동차감') || ' (install:' || p_install_id || ')'
      );
    END IF;
  END LOOP;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION deduct_inventory_on_install(jsonb, uuid, text) TO authenticated;
