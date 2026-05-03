export default function SortableTh({ col, sortCol, sortDir, onSort, children, style, ...rest }) {
  return (
    <th onClick={() => onSort(col)} style={{cursor:'pointer',userSelect:'none',...(style||{})}} {...rest}>
      {children}<span style={{marginLeft:2,opacity:0.4,fontSize:8}}>{sortCol===col?(sortDir==='asc'?'▲':'▼'):'⇅'}</span>
    </th>
  );
}
