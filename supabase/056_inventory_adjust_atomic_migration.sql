-- 재고 수량 조정을 원자적으로 처리하는 RPC.
-- 기존에는 클라이언트가 (현재값 + delta)를 계산해서 그대로 UPDATE로 덮어썼기 때문에,
-- 두 사용자가 동시에 조정하면 나중에 도착한 쓰기가 앞선 변경을 덮어써 수량이 어긋났음.
-- DB에서 quantity = quantity + delta 로 갱신하면 동시 호출도 순차적으로 정확히 반영됨.
create or replace function adjust_inventory_quantity(p_item_id uuid, p_delta integer)
returns inventory_items
language plpgsql
security definer
set search_path = public
as $$
declare
  result inventory_items;
begin
  update inventory_items
  set quantity = greatest(0, quantity + p_delta),
      last_checked = current_date
  where id = p_item_id
  returning * into result;

  if result.id is null then
    raise exception 'inventory item not found: %', p_item_id;
  end if;

  return result;
end;
$$;

grant execute on function adjust_inventory_quantity(uuid, integer) to authenticated;
