(module
 (type $0 (func (param f32 f32 f32 i32) (result i32)))
 (memory $0 2)
 (export "checkCollision" (func $assembly/index/checkCollision))
 (export "memory" (memory $0))
 (func $assembly/index/checkCollision (param $0 f32) (param $1 f32) (param $2 f32) (param $3 i32) (result i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 f32)
  loop $for-loop|0
   local.get $3
   local.get $4
   i32.gt_s
   if
    local.get $0
    local.get $4
    i32.const 12
    i32.mul
    local.tee $5
    f32.load
    f32.sub
    local.tee $6
    local.get $6
    f32.mul
    local.get $1
    local.get $5
    f32.load offset=4
    f32.sub
    local.tee $6
    local.get $6
    f32.mul
    f32.add
    local.get $2
    local.get $5
    f32.load offset=8
    f32.add
    local.tee $6
    local.get $6
    f32.mul
    f32.lt
    if
     local.get $4
     return
    end
    local.get $4
    i32.const 1
    i32.add
    local.set $4
    br $for-loop|0
   end
  end
  i32.const -1
 )
)
