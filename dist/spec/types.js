//#region src/spec/types.ts
/**
* Two-way binding to `formName.fieldName`.
*
* Canonical spelling is a bare prop key — `props: { $field: "contact.email" }` —
* which wires `value`/`checked` and `onChange` together from one declaration.
* The longhand `props: { value: { $field: "contact.email" } }` is also accepted.
*/
var FIELD_BINDING_KEY = "$field";
var isRefNode = (n) => typeof n === "object" && n !== null && "$ref" in n;
var isEachNode = (n) => typeof n === "object" && n !== null && "$each" in n;
var isCondNode = (n) => typeof n === "object" && n !== null && "$cond" in n;
var isComponentNode = (n) => typeof n === "object" && n !== null && "component" in n;
var isFieldBinding = (v) => typeof v === "object" && v !== null && "$field" in v && typeof v.$field === "string";
var isRefValue = (v) => typeof v === "object" && v !== null && "$ref" in v && typeof v.$ref === "string";
var isEventHandlerSpec = (v) => typeof v === "object" && v !== null && "action" in v && typeof v.action === "string";
//#endregion
export { FIELD_BINDING_KEY, isComponentNode, isCondNode, isEachNode, isEventHandlerSpec, isFieldBinding, isRefNode, isRefValue };

//# sourceMappingURL=types.js.map