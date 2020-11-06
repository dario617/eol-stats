import React, { useState, useEffect } from 'react';
import { std, mean } from 'mathjs';

const add = (a, b) => a + b;

/**
 * Compute and parse course data into headers, rows and plot information
 *
 * @param {*} course
 * @param {*} sum
 * @param {*} sum_key
 * @param {*} recoverSum
 * @param {*} setErrors
 * @param {*} upperDate
 * @param {*} lowerDate
 */
function useProcessSumData(
  course,
  sum,
  sum_key,
  recoverSum,
  setErrors,
  upperDate,
  lowerDate
) {
  const [tableData, setTableData] = useState({
    loaded: false,
    chapters: [],
    sequentials: [],
    verticals: [],
    mapping: [], // Vertical_ids to column index
    all: 0, // Column counter
    course_info: {},
  });

  const [rowData, setRowData] = useState({
    all: [],
    chapters: [],
    verticals: [],
    grouped_verticals: [],
  });

  // Recover incoming data for table
  useEffect(() => {
    if (course.course.length !== 0) {
      let current = course.course[0];
      // Get all the numbers
      let chapters = [];
      let sequentials = [];
      let verticals = [];
      let mapping = {};
      let all = 0;
      current.chapters.forEach((ch, key_ch) => {
        let subtotal = 0;
        ch.sequentials.forEach((seq, key_seq) => {
          seq.verticals.forEach((vert, key_vert) => {
            verticals.push({
              id: vert.vertical_id,
              val: `${key_ch + 1}.${key_seq + 1}.${key_vert + 1}`,
              tooltip: vert.name,
            });
            // Store array position id for row mapping
            mapping[vert.vertical_id] = all;
            all += 1;
          });
          subtotal += seq.verticals.length;
          sequentials.push(
            <th colSpan={seq.verticals.length} scope="col" key={seq.name}>{`${
              key_ch + 1
            }.${key_seq + 1}`}</th>
          );
        });
        chapters.push({ name: ch.name, subtotal });
      });

      setTableData({
        loaded: true,
        chapters,
        sequentials,
        verticals,
        mapping,
        all,
      });

      // Load sum
      recoverSum(current.id, new Date(lowerDate), new Date(upperDate));
    }
    // eslint-disable-next-line
  }, [course.course]);

  // Parse visits as rows
  useEffect(() => {
    if (tableData.loaded && sum.length !== 0) {
      let rows = [];
      let users = {};
      let chapterRow = [];
      let verticals = {}; // {students, views, name, id}
      let grouped_verticals = []; // {students, views}
      // Group by username
      sum.map((t) => {
        if (t.username in users) {
          users[t.username].push(t);
        } else {
          users[t.username] = [t];
        }
      });

      // Get chapters length
      let subtotalsIndex = [];
      tableData.chapters.forEach((el, k) => {
        let sum = el.subtotal;
        if (subtotalsIndex[k - 1]) {
          sum = sum + subtotalsIndex[k - 1];
        }
        subtotalsIndex.push(sum);
      });

      // Map Rows with verticals
      Object.keys(users).forEach((u) => {
        // Fill array with zeros
        let values = Array.from(Array(tableData.all), () => 0);
        // Fill positions with visit
        for (let index = 0; index < users[u].length; index++) {
          if (tableData.mapping[users[u][index][sum_key]] !== undefined) {
            values[tableData.mapping[users[u][index][sum_key]]] =
              users[u][index].total;

            // Check if verticals have info
            if (verticals[users[u][index][sum_key]] !== undefined) {
              verticals[users[u][index][sum_key]].visits =
                verticals[users[u][index][sum_key]].visits +
                users[u][index].total;
              verticals[users[u][index][sum_key]].students =
                verticals[users[u][index][sum_key]].students + 1;
            } else {
              verticals[users[u][index][sum_key]] = {
                visits: users[u][index].total,
                students: 1,
              };
            }
          }
        }
        // Put rows for all
        rows.push([u, ...values]);
        // Put each sub sum for each chapter
        let currentChapterRow = [u];
        subtotalsIndex.forEach((st, k) => {
          let leftIndex = subtotalsIndex[k - 1] ? subtotalsIndex[k - 1] : 0;
          let subArray = values.slice(leftIndex, st);
          let currentSum = subArray.reduce(add, 0);
          currentChapterRow.push(currentSum);
        });
        chapterRow.push(currentChapterRow);
      });

      // Process each chapter and add
      chapterRow.forEach((row_sum) => {
        row_sum.forEach((sum, index) => {
          // First index 0 has student names
          if (index > 0 && grouped_verticals[index - 1]) {
            if (sum > 0) {
              grouped_verticals[index - 1].visits =
                grouped_verticals[index - 1].visits + sum;
              grouped_verticals[index - 1].students =
                grouped_verticals[index - 1].students + 1;
            }
          } else if (index > 0) {
            grouped_verticals.push({ visits: sum, students: sum > 0 ? 1 : 0 });
          }
        });
      });

      // Compute totals per vertical
      let named_verticals = tableData.verticals.map((vertical) => {
        let v_info = verticals[vertical.id]
          ? verticals[vertical.id]
          : { visits: 0, students: 0 };
        return {
          ...v_info,
          ...vertical,
        };
      });

      // Compute std deviation
      // Traverse rows
      let vertical_errors = [];
      for (let i = 1; i < rows[0].length; i++) {
        let user_v = rows.map((el) => el[i]);
        vertical_errors.push(std(user_v));
      }

      let test_ver = [
        [0, 1, 2, 3],
        [0, 1, 2, 3],
        [0, 1, 2, 3],
      ];
      let test_sum_index = [2, 4];
      test_sum_index.forEach((st, k) => {
        let leftIndex = test_sum_index[k - 1] ? test_sum_index[k - 1] : 0;
        let subArray = test_ver.map((row) => row.slice(leftIndex + 1, st + 1));
        let var_a = std(subArray);
      });

      // Compute std deviation
      // Traverse groups of rows
      // to create a matrix to compute std
      // NOTE: ignore index 1
      let grouped_verticals_errors = [];
      subtotalsIndex.forEach((st, k) => {
        let leftIndex = subtotalsIndex[k - 1] ? subtotalsIndex[k - 1] : 0;
        let subArray = rows.map((row) => row.slice(leftIndex + 1, st + 1));
        grouped_verticals_errors.push(std(subArray));
      });

      setRowData({
        all: rows,
        chapters: chapterRow,
        verticals: named_verticals,
        grouped_verticals: grouped_verticals,
        vertical_errors,
        grouped_verticals_errors,
      });
      setErrors([]);
    }
  }, [tableData.loaded, sum]);

  return [tableData, setTableData, rowData, setRowData];
}

export default useProcessSumData;
