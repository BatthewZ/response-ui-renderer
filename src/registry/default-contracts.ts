import { NAME_PROP_MEANING } from "../render/id-scope";
import {
  type ComponentContract,
  type ComponentContracts,
  DIALOG_COMPONENTS,
  PROP_ENUMS,
} from "../spec/contracts";
import { CHILD_INSPECTING_PARENTS } from "./child-introspection";
import { FUNCTION_CHILDREN } from "./function-children";
import { COMPONENT_TYPED_ICON_SLOTS } from "./icon-slots";
import { PROP_COERCIONS } from "./prop-coercions";
import { splitSlotKey } from "./slot-keys";
import { TEXT_CHILDREN } from "./text-children";

/**
 * Everything this package knows about `@batthewz/response-ui-react-components`,
 * as one record per addressable name.
 *
 * Assembled from the tables rather than restating them: each table is either
 * generated from the library's declarations or gated against them by
 * `contracts.test.ts`, and a second hand-kept copy in this shape would be the
 * one that goes wrong. The tables stay the source and stay exported — they are
 * the shape a prompt builder wants — and this is the shape the renderer and the
 * validator read.
 *
 * Carries only what one of those two acts on. The curated category and note,
 * like the prop tables and slot keys, are documentation: they belong to
 * `defaultReferenceContracts` and its own entry point, so a server-side gate
 * importing `/spec` does not carry kilobytes of authoring prose it never reads.
 */
/** The public type is deeply readonly; assembly needs one writable view of it. */
type Draft = { -readonly [K in keyof ComponentContract]: ComponentContract[K] };

function buildDefaultContracts(): ComponentContracts {
  const contracts: Record<string, Draft> = Object.create(null) as Record<string, Draft>;

  const at = (name: string): Draft => {
    if (!Object.hasOwn(contracts, name)) contracts[name] = {};
    return contracts[name];
  };

  for (const [key, values] of Object.entries(PROP_ENUMS)) {
    const [name, prop] = splitSlotKey(key);
    const contract = at(name);
    contract.propEnums = { ...contract.propEnums, [prop]: values };
  }

  for (const [key, coercion] of PROP_COERCIONS) {
    const [name, prop] = splitSlotKey(key);
    const contract = at(name);
    contract.coercions = { ...contract.coercions, [prop]: coercion };
  }

  for (const [name, functionChildren] of Object.entries(FUNCTION_CHILDREN)) {
    at(name).functionChildren = functionChildren;
  }

  for (const [name, textChildren] of Object.entries(TEXT_CHILDREN)) {
    at(name).textChildren = textChildren;
  }

  for (const name of DIALOG_COMPONENTS) at(name).dialog = true;

  for (const [name, mode] of CHILD_INSPECTING_PARENTS) at(name).childInspection = mode;

  for (const key of COMPONENT_TYPED_ICON_SLOTS) {
    const [name, prop] = splitSlotKey(key);
    const contract = at(name);
    contract.iconComponentProps = [...(contract.iconComponentProps ?? []), prop];
  }

  for (const [name, meaning] of Object.entries(NAME_PROP_MEANING)) {
    at(name).nameProp = meaning;
  }

  return contracts;
}

export const defaultContracts: ComponentContracts = buildDefaultContracts();
